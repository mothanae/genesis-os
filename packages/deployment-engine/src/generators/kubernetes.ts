import type { GraphNode, GraphEdge } from '@genesis-1/shared';
import type { DeployableModule, DeploymentConfig } from '../engine';

export class KubernetesGenerator {
  generate(nodes: GraphNode[], edges: GraphEdge[], config: DeploymentConfig): DeployableModule[] {
    const modules: DeployableModule[] = [];
    const services = nodes.filter((n) =>
      ['service', 'function', 'container', 'api_gateway'].includes(n.type),
    );

    // Namespace
    modules.push(this.generateNamespace(config));

    // Per-service: Deployment + Service + ConfigMap
    for (const svc of services) {
      modules.push(this.generateDeployment(svc, config));
      modules.push(this.generateService(svc, config));
      modules.push(this.generateConfigMap(svc, config));
    }

    // Ingress for API gateways
    const gateways = nodes.filter((n) => n.type === 'api_gateway');
    if (gateways.length > 0) {
      modules.push(this.generateIngress(gateways, config));
    }

    // HPA for scalable services
    if (config.scaling) {
      for (const svc of services) {
        modules.push(this.generateHPA(svc, config));
      }
    }

    // Kustomization
    modules.push(this.generateKustomization(config));

    return modules;
  }

  private generateNamespace(config: DeploymentConfig): DeployableModule {
    return {
      path: `k8s/base/namespace.yaml`,
      content: `apiVersion: v1
kind: Namespace
metadata:
  name: genesis-${config.environment}
  labels:
    environment: ${config.environment}
    managed-by: genesis-1`,
      language: 'yaml', type: 'kubernetes', description: `Namespace for ${config.environment}`,
    };
  }

  private generateDeployment(svc: GraphNode, config: DeploymentConfig): DeployableModule {
    const name = svc.name.toLowerCase().replace(/\s+/g, '-');
    const replicas = config.scaling?.min ?? 1;
    const port = (svc.runtime as Record<string, unknown>)?.port ?? 3000;
    const memory = (svc.runtime as Record<string, unknown>)?.memory ?? '256Mi';
    const cpu = (svc.runtime as Record<string, unknown>)?.cpu ?? '250m';

    return {
      path: `k8s/base/${name}-deployment.yaml`,
      content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: genesis-${config.environment}
  labels:
    app: ${name}
    component: ${svc.type}
    managed-by: genesis-1
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: ${name}
        version: v1
    spec:
      containers:
        - name: ${name}
          image: ${name}:latest
          ports:
            - containerPort: ${port}
          resources:
            requests:
              cpu: ${cpu}
              memory: ${memory}
            limits:
              cpu: '${parseFloat(cpu as string) * 2}${(cpu as string).includes('m') ? 'm' : ''}'
              memory: '${parseInt(memory as string) * 2}Mi'
          livenessProbe:
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 5
            periodSeconds: 10
          envFrom:
            - configMapRef:
                name: ${name}-config`,
      language: 'yaml', type: 'kubernetes', description: `Deployment for ${svc.name}`,
    };
  }

  private generateService(svc: GraphNode, config: DeploymentConfig): DeployableModule {
    const name = svc.name.toLowerCase().replace(/\s+/g, '-');
    const port = (svc.runtime as Record<string, unknown>)?.port ?? 3000;

    return {
      path: `k8s/base/${name}-service.yaml`,
      content: `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: genesis-${config.environment}
  labels:
    app: ${name}
    managed-by: genesis-1
spec:
  selector:
    app: ${name}
  ports:
    - protocol: TCP
      port: ${port}
      targetPort: ${port}
  type: ClusterIP`,
      language: 'yaml', type: 'kubernetes', description: `Service for ${svc.name}`,
    };
  }

  private generateConfigMap(svc: GraphNode, config: DeploymentConfig): DeployableModule {
    const name = svc.name.toLowerCase().replace(/\s+/g, '-');
    const env = (svc.runtime as Record<string, unknown>)?.env as Record<string, string> ?? {};

    return {
      path: `k8s/base/${name}-config.yaml`,
      content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}-config
  namespace: genesis-${config.environment}
data:
  NODE_ENV: "${config.environment}"
${Object.entries(env).map(([k, v]) => `  ${k}: "${v}"`).join('\n')}`,
      language: 'yaml', type: 'kubernetes', description: `ConfigMap for ${svc.name}`,
    };
  }

  private generateHPA(svc: GraphNode, config: DeploymentConfig): DeployableModule {
    const name = svc.name.toLowerCase().replace(/\s+/g, '-');
    return {
      path: `k8s/base/${name}-hpa.yaml`,
      content: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${name}
  namespace: genesis-${config.environment}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${name}
  minReplicas: ${config.scaling?.min ?? 1}
  maxReplicas: ${config.scaling?.max ?? 10}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: ${config.scaling?.targetCpuPercent ?? 70}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: ${config.scaling?.targetCpuPercent ?? 70}`,
      language: 'yaml', type: 'kubernetes', description: `HPA for ${svc.name}`,
    };
  }

  private generateIngress(gateways: GraphNode[], config: DeploymentConfig): DeployableModule {
    const rules = gateways.map((gw) => {
      const name = gw.name.toLowerCase().replace(/\s+/g, '-');
      return `  - host: ${name}.${config.domain ?? 'localhost'}
    http:
      paths:
        - path: /
          pathType: Prefix
          backend:
            service:
              name: ${name}
              port:
                number: ${(gw.runtime as Record<string, unknown>)?.port ?? 3000}`;
    }).join('\n');

    return {
      path: 'k8s/base/ingress.yaml',
      content: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: genesis-ingress
  namespace: genesis-${config.environment}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - ${gateways.map((g) => `${g.name.toLowerCase().replace(/\s+/g, '-')}.${config.domain ?? 'localhost'}`).join('\n        - ')}
      secretName: genesis-tls
  rules:
${rules}`,
      language: 'yaml', type: 'kubernetes', description: 'Ingress configuration',
    };
  }

  private generateKustomization(config: DeploymentConfig): DeployableModule {
    return {
      path: 'k8s/base/kustomization.yaml',
      content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: genesis-${config.environment}
resources:
  - namespace.yaml
  - ingress.yaml
commonLabels:
  environment: ${config.environment}
  managed-by: genesis-1`,
      language: 'yaml', type: 'kubernetes', description: 'Kustomization config',
    };
  }
}
