import type { GraphEngine } from '@genesis-1/graph-engine';
import type { EventPublisher } from '@genesis-1/event-bus';
import { EventType } from '@genesis-1/shared';
import { DockerGenerator } from './generators/docker';
import { KubernetesGenerator } from './generators/kubernetes';
import { TerraformGenerator } from './generators/terraform';
import { CICDGenerator } from './generators/cicd';
import { MonitoringGenerator } from './generators/monitoring';

// ── Types ─────────────────────────────────────────────────────

export interface DeployableModule {
  path: string;
  content: string;
  language: 'dockerfile' | 'yaml' | 'hcl' | 'json' | 'toml';
  type: 'docker' | 'kubernetes' | 'terraform' | 'cicd' | 'monitoring' | 'config';
  description: string;
}

export interface DeploymentConfig {
  projectId: string;
  environment: 'development' | 'staging' | 'production';
  platform: 'docker' | 'kubernetes' | 'ecs' | 'lambda';
  cloudProvider?: 'aws' | 'gcp' | 'azure';
  region?: string;
  domain?: string;
  monitoring?: { prometheus: boolean; grafana: boolean; alerting: boolean };
  scaling?: { min: number; max: number; targetCpuPercent: number };
  rollback?: { enabled: boolean; maxRevisions: number };
}

export interface DeploymentResult {
  success: boolean;
  projectId: string;
  modules: DeployableModule[];
  errors: string[];
  deploymentPlan: {
    order: string[];
    estimatedMinutes: number;
    rollbackPlan: string[];
  };
}

// ── Engine ────────────────────────────────────────────────────

export class DeploymentEngine {
  private docker = new DockerGenerator();
  private k8s = new KubernetesGenerator();
  private terraform = new TerraformGenerator();
  private cicd = new CICDGenerator();
  private monitoring = new MonitoringGenerator();

  constructor(
    private readonly graphEngine: GraphEngine,
    private readonly eventBus: EventPublisher,
  ) {}

  async generateDeployment(config: DeploymentConfig): Promise<DeploymentResult> {
    await this.publish(EventType.DeploymentStarted, config.projectId, { config });

    const modules: DeployableModule[] = [];
    const errors: string[] = [];

    try {
      const { data: allNodes } = await this.graphEngine.listNodes(config.projectId);
      const allEdges = await this.graphEngine.listEdges(config.projectId);

      // 1. Docker generation
      try {
        const dockerModules = this.docker.generate(allNodes, config);
        modules.push(...dockerModules);
      } catch (e) { errors.push(`Docker: ${(e as Error).message}`); }

      // 2. Kubernetes generation (if applicable)
      if (config.platform === 'kubernetes') {
        try {
          const k8sModules = this.k8s.generate(allNodes, allEdges, config);
          modules.push(...k8sModules);
        } catch (e) { errors.push(`Kubernetes: ${(e as Error).message}`); }
      }

      // 3. Terraform generation (if cloud provider specified)
      if (config.cloudProvider) {
        try {
          const tfModules = this.terraform.generate(allNodes, config);
          modules.push(...tfModules);
        } catch (e) { errors.push(`Terraform: ${(e as Error).message}`); }
      }

      // 4. CI/CD pipeline
      try {
        const cicdModules = this.cicd.generate(config);
        modules.push(...cicdModules);
      } catch (e) { errors.push(`CI/CD: ${(e as Error).message}`); }

      // 5. Monitoring setup
      try {
        const monModules = this.monitoring.generate(config);
        modules.push(...monModules);
      } catch (e) { errors.push(`Monitoring: ${(e as Error).message}`); }

      // 6. Environment config
      modules.push(this.generateEnvConfig(config));

      const plan = this.buildDeploymentPlan(modules);
      const result: DeploymentResult = {
        success: errors.length === 0,
        projectId: config.projectId,
        modules,
        errors,
        deploymentPlan: plan,
      };

      await this.publish(EventType.DeploymentCompleted, config.projectId, {
        moduleCount: modules.length,
        errors: errors.length,
        plan,
      });

      return result;
    } catch (error) {
      await this.publish(EventType.DeploymentFailed, config.projectId, { error: (error as Error).message });
      return {
        success: false,
        projectId: config.projectId,
        modules,
        errors: [...errors, (error as Error).message],
        deploymentPlan: { order: [], estimatedMinutes: 0, rollbackPlan: [] },
      };
    }
  }

  async simulateDeployment(config: DeploymentConfig): Promise<DeploymentResult> {
    // Dry-run: generate but mark as simulation
    const result = await this.generateDeployment(config);
    // Add dry-run marker to paths
    result.modules = result.modules.map((m) => ({
      ...m,
      path: `dry-run/${m.path}`,
    }));
    return result;
  }

  async rollback(projectId: string, revision: string): Promise<void> {
    await this.publish('genesis-1.deployment.rollback' as EventType, projectId, { revision });
    // Rollback logic: restore previous deployment artifacts
  }

  // ── Helpers ────────────────────────────────────────────────

  private generateEnvConfig(config: DeploymentConfig): DeployableModule {
    return {
      path: `environments/${config.environment}/.env`,
      content: `# Generated by Genesis-1 Deployment Engine
# Environment: ${config.environment}
# Cloud: ${config.cloudProvider ?? 'none'}
# Region: ${config.region ?? 'us-east-1'}

NODE_ENV=${config.environment === 'production' ? 'production' : config.environment}
PORT=3000
LOG_LEVEL=${config.environment === 'production' ? 'info' : 'debug'}

# Database
DATABASE_URL=\${DATABASE_URL}
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=${config.scaling?.max ? config.scaling.max * 2 : 20}

# Redis
REDIS_URL=\${REDIS_URL}

# Monitoring
PROMETHEUS_ENABLED=${config.monitoring?.prometheus ?? true ? 'true' : 'false'}
GRAFANA_ENABLED=${config.monitoring?.grafana ?? true ? 'true' : 'false'}

# Scaling
SCALING_MIN=${config.scaling?.min ?? 1}
SCALING_MAX=${config.scaling?.max ?? 10}
SCALING_CPU_TARGET=${config.scaling?.targetCpuPercent ?? 70}
`,
      language: 'toml',
      type: 'config',
      description: `Environment configuration for ${config.environment}`,
    };
  }

  private buildDeploymentPlan(modules: DeployableModule[]) {
    const order: string[] = [];
    const typeOrder = ['docker', 'config', 'kubernetes', 'terraform', 'cicd', 'monitoring'];
    for (const t of typeOrder) {
      const count = modules.filter((m) => m.type === t).length;
      if (count > 0) order.push(`${t} (${count} files)`);
    }
    return {
      order,
      estimatedMinutes: modules.length * 0.1 + 2,
      rollbackPlan: [...order].reverse().map((s) => `rollback ${s}`),
    };
  }

  private async publish(type: EventType, projectId: string, payload: Record<string, unknown>): Promise<void> {
    await this.eventBus.publish(type as string, {
      id: crypto.randomUUID(), type, source: 'deployment-engine', correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(), projectId, payload, metadata: { version: 1, priority: 'normal' },
    });
  }
}
