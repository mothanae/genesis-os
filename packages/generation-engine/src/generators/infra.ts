import type { GraphNode } from '@genesis-1/shared';

export interface InfraGenOptions {
  platform: 'docker' | 'kubernetes' | 'terraform';
  cloud?: 'aws' | 'gcp' | 'azure';
}

interface GeneratedFile {
  type: 'docker' | 'config';
  path: string;
  content: string;
}

export class InfraGenerator {
  generate(nodes: GraphNode[], options: InfraGenOptions): GeneratedFile[] {
    const infraNodes = nodes.filter((n) =>
      ['environment', 'region', 'cluster', 'namespace', 'container', 'pod', 'load_balancer', 'dns'].includes(n.type),
    );

    const modules: GeneratedFile[] = [];

    switch (options.platform) {
      case 'docker':
        modules.push(...this.generateDocker(nodes, infraNodes));
        break;
      case 'kubernetes':
        modules.push(...this.generateKubernetes(nodes, infraNodes, options));
        break;
      case 'terraform':
        modules.push(...this.generateTerraform(nodes, infraNodes, options));
        break;
    }

    return modules;
  }

  private generateDocker(nodes: GraphNode[], infraNodes: GraphNode[]): GeneratedFile[] {
    const modules: GeneratedFile[] = [];
    const services = nodes.filter((n) => ['service', 'function', 'api_gateway'].includes(n.type));
    const databases = nodes.filter((n) => ['database', 'cache', 'queue'].includes(n.type));

    // docker-compose.yml
    modules.push({
      type: 'docker',
      path: 'docker-compose.yml',
      content: this.generateDockerCompose(services, databases),
    });

    // .dockerignore
    modules.push({
      type: 'docker',
      path: '.dockerignore',
      content: `node_modules
.next
dist
.git
.gitignore
*.md
.env
.env.*
!.env.example
coverage
.turbo
`,
    });

    // Dockerfile per service
    for (const svc of services) {
      modules.push({
        type: 'docker',
        path: `docker/${this.toKebab(svc.name)}.Dockerfile`,
        content: this.generateServiceDockerfile(svc),
      });
    }

    return modules;
  }

  private generateKubernetes(nodes: GraphNode[], infraNodes: GraphNode[], options: InfraGenOptions): GeneratedFile[] {
    const modules: GeneratedFile[] = [];
    const services = nodes.filter((n) => ['service', 'function', 'api_gateway'].includes(n.type));

    // Namespace
    modules.push({
      type: 'config',
      path: 'k8s/namespace.yaml',
      content: `apiVersion: v1
kind: Namespace
metadata:
  name: genesis-app
  labels:
    app.kubernetes.io/managed-by: genesis-1
`,
    });

    // ConfigMap
    modules.push({
      type: 'config',
      path: 'k8s/configmap.yaml',
      content: this.generateK8sConfigMap(options),
    });

    // Deployments and Services per service
    for (const svc of services) {
      const name = this.toKebab(svc.name);
      modules.push({
        type: 'config',
        path: `k8s/${name}-deployment.yaml`,
        content: this.generateK8sDeployment(svc, options),
      });
      modules.push({
        type: 'config',
        path: `k8s/${name}-service.yaml`,
        content: this.generateK8sService(svc),
      });
    }

    // HPA
    if (services.length > 0) {
      modules.push({
        type: 'config',
        path: `k8s/${this.toKebab(services[0]!.name)}-hpa.yaml`,
        content: this.generateHPA(services[0]!),
      });
    }

    return modules;
  }

  private generateTerraform(nodes: GraphNode[], infraNodes: GraphNode[], options: InfraGenOptions): GeneratedFile[] {
    const modules: GeneratedFile[] = [];
    const cloud = options.cloud ?? 'aws';

    modules.push({
      type: 'config',
      path: 'terraform/main.tf',
      content: this.generateTerraformMain(nodes, cloud),
    });

    modules.push({
      type: 'config',
      path: 'terraform/variables.tf',
      content: this.generateTerraformVariables(cloud),
    });

    modules.push({
      type: 'config',
      path: 'terraform/outputs.tf',
      content: this.generateTerraformOutputs(nodes, cloud),
    });

    return modules;
  }

  // ── Docker Generators ──────────────────────────────────────

  private generateDockerCompose(
    services: Array<{ name: string; type: string }>,
    databases: Array<{ name: string; type: string }>,
  ): string {
    const serviceEntries = services.map((svc) => {
      const name = this.toKebab(svc.name);
      return `  ${name}:
    build:
      context: .
      dockerfile: docker/${name}.Dockerfile
    ports:
      - "\${${name.toUpperCase()}_PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 128M`;
    });

    const dbEntries = databases.map((db) => {
      const name = this.toKebab(db.name);
      const image = db.type === 'cache' ? 'redis:7-alpine' : db.type === 'queue' ? 'redis:7-alpine' : 'postgres:16-alpine';
      const port = db.type === 'cache' || db.type === 'queue' ? '6379' : '5432';

      return `  ${name}:
    image: ${image}
    ports:
      - "\${${name.toUpperCase()}_PORT:-${port}}:${port}"
    volumes:
      - ${name}_data:/${db.type === 'cache' ? 'data' : db.type === 'queue' ? 'data' : 'var/lib/postgresql/data'}
    healthcheck:
      test: ["CMD", "${db.type === 'cache' || db.type === 'queue' ? 'redis-cli' : 'pg_isready'}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5`;
    });

    const volumes = databases.map((db) => `  ${this.toKebab(db.name)}_data:`);

    return `version: '3.8'

services:
${serviceEntries.join('\n\n')}
${dbEntries.length > 0 ? '\n' + dbEntries.join('\n\n') : ''}
${volumes.length > 0 ? '\nvolumes:\n' + volumes.join('\n') : ''}`;
  }

  private generateServiceDockerfile(node: { name: string; runtime?: unknown }): string {
    const rt = (node.runtime as Record<string, unknown>) ?? {};
    const port = (rt.port as number) ?? 3000;

    return `# Generated Dockerfile: ${node.name}
FROM node:20-alpine AS base
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --production

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

USER app
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --spider http://localhost:${port}/health || exit 1

CMD ["node", "dist/index.js"]`;
  }

  // ── Kubernetes Generators ──────────────────────────────────

  private generateK8sDeployment(node: { name: string; runtime?: unknown }, options: InfraGenOptions): string {
    const name = this.toKebab(node.name);
    const rt = (node.runtime as Record<string, unknown>) ?? {};
    const port = (rt.port as number) ?? 3000;
    const replicas = (rt.minReplicas as number) ?? 2;

    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: genesis-app
  labels:
    app: ${name}
    app.kubernetes.io/managed-by: genesis-1
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: ${name}
        app.kubernetes.io/managed-by: genesis-1
    spec:
      containers:
        - name: ${name}
          image: \${DOCKER_REGISTRY:-registry.example.com}/${name}:latest
          ports:
            - containerPort: ${port}
              protocol: TCP
          envFrom:
            - configMapRef:
                name: genesis-app-config
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 5
            periodSeconds: 10`;
  }

  private generateK8sService(node: { name: string; runtime?: unknown }): string {
    const name = this.toKebab(node.name);
    const rt = (node.runtime as Record<string, unknown>) ?? {};
    const port = (rt.port as number) ?? 3000;

    return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: genesis-app
  labels:
    app: ${name}
spec:
  type: ClusterIP
  selector:
    app: ${name}
  ports:
    - port: ${port}
      targetPort: ${port}
      protocol: TCP
      name: http`;
  }

  private generateK8sConfigMap(_options: InfraGenOptions): string {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: genesis-app-config
  namespace: genesis-app
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  API_HOST: "0.0.0.0"
`;
  }

  private generateHPA(node: { name: string }): string {
    const name = this.toKebab(node.name);

    return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${name}-hpa
  namespace: genesis-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${name}
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30`;
  }

  // ── Terraform Generators ──────────────────────────────────

  private generateTerraformMain(
    nodes: Array<{ name: string; type: string }>,
    cloud: string,
  ): string {
    const services = nodes.filter((n) => ['service', 'function', 'api_gateway'].includes(n.type));
    const hasDb = nodes.some((n) => n.type === 'database');

    if (cloud === 'aws') {
      return `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5"
}

provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "genesis-vpc" }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.\${count.index}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "genesis-public-\${count.index}" }
}

# ECR Repositories
${services.map((s) => `resource "aws_ecr_repository" "${this.toSnake(s.name)}" {
  name                 = "genesis/${this.toKebab(s.name)}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
}
`).join('\n')}
# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "genesis-cluster"
}

# ECS Task Definitions
${services.map((s) => `resource "aws_ecs_task_definition" "${this.toSnake(s.name)}" {
  family                   = "${this.toKebab(s.name)}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  container_definitions    = jsonencode([{
    name  = "${this.toKebab(s.name)}"
    image = "\${aws_ecr_repository.${this.toSnake(s.name)}.repository_url}:latest"
    portMappings = [{ containerPort = 3000 }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/genesis/${this.toKebab(s.name)}"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "service"
      }
    }
  }])
}
`).join('\n')}
${hasDb ? `# RDS Database
resource "aws_db_instance" "main" {
  identifier           = "genesis-db"
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = var.db_instance_class
  allocated_storage    = 20
  username             = var.db_username
  password             = var.db_password
  skip_final_snapshot  = true
  publicly_accessible  = false
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}
` : ''}`;
    }

    return `# Generated Terraform: ${cloud}\n# Provider-specific configuration\n`;
  }

  private generateTerraformVariables(cloud: string): string {
    if (cloud === 'aws') {
      return `variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_username" {
  description = "Database username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}
`;
    }
    return `# Terraform variables — ${cloud}\n`;
  }

  private generateTerraformOutputs(
    nodes: Array<{ name: string; type: string }>,
    cloud: string,
  ): string {
    if (cloud === 'aws') {
      const services = nodes.filter((n) => ['service', 'function', 'api_gateway'].includes(n.type));
      return `${services.map((s) => `output "${this.toSnake(s.name)}_repo_url" {
  value       = aws_ecr_repository.${this.toSnake(s.name)}.repository_url
  description = "ECR repository URL for ${s.name}"
}
`).join('\n')}output "ecs_cluster_arn" {
  value       = aws_ecs_cluster.main.arn
  description = "ECS cluster ARN"
}

output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}
`;
    }
    return `# Terraform outputs — ${cloud}\n`;
  }

  // ── Helpers ───────────────────────────────────────────────

  private toKebab(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  private toSnake(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }
}
