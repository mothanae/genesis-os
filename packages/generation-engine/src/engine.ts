import type { GraphEngine } from '@genesis-1/graph-engine';
import type { EventPublisher } from '@genesis-1/event-bus';
import { EventType } from '@genesis-1/shared';

// ── Types ─────────────────────────────────────────────────────

export interface GenerationConfig {
  projectId: string;
  targetStack: 'react' | 'nextjs' | 'nodejs' | 'fastapi' | 'laravel' | 'django' | 'golang' | 'rust';
  outputDir: string;
  options: Record<string, unknown>;
}

export interface GeneratedModule {
  path: string;
  content: string;
  language: string;
  type: 'component' | 'service' | 'route' | 'schema' | 'config' | 'test' | 'docs' | 'docker';
}

export interface GenerationResult {
  success: boolean;
  projectId: string;
  modules: GeneratedModule[];
  errors: string[];
  stats: {
    totalFiles: number;
    totalLines: number;
    languages: string[];
    durationMs: number;
  };
}

// ── Engine ────────────────────────────────────────────────────

export class GenerationEngine {
  constructor(
    private readonly graphEngine: GraphEngine,
    private readonly eventBus: EventPublisher,
  ) {}

  async generate(config: GenerationConfig): Promise<GenerationResult> {
    const startedAt = Date.now();

    await this.eventBus.publish('genesis-1.generation.started', {
      id: crypto.randomUUID(),
      type: EventType.GenerationStarted,
      source: 'generation-engine',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      projectId: config.projectId,
      payload: { targetStack: config.targetStack, options: config.options },
      metadata: { version: 1, priority: 'normal' },
    });

    const modules: GeneratedModule[] = [];
    const errors: string[] = [];

    try {
      // 1. Load graph topology
      const { data: allNodes } = await this.graphEngine.listNodes(config.projectId);
      const allEdges = await this.graphEngine.listEdges(config.projectId);

      // 2. Generate by node type
      for (const node of allNodes) {
        try {
          const nodeModules = this.generateForNode(node, allEdges as unknown[], config);
          modules.push(...nodeModules);

          await this.eventBus.publish('genesis-1.generation.module.generated', {
            id: crypto.randomUUID(),
            type: EventType.GenerationModuleGenerated,
            source: 'generation-engine',
            correlationId: config.projectId,
            timestamp: new Date().toISOString(),
            projectId: config.projectId,
            payload: { nodeId: node.id, nodeType: node.type, moduleCount: nodeModules.length },
            metadata: { version: 1, priority: 'normal' },
          });
        } catch (err) {
          errors.push(`Failed to generate for node ${node.id}: ${(err as Error).message}`);
        }
      }

      // 3. Generate project-level files
      const projectModules = this.generateProjectFiles(allNodes, config);
      modules.push(...projectModules);

      const durationMs = Date.now() - startedAt;
      const stats = {
        totalFiles: modules.length,
        totalLines: modules.reduce((sum, m) => sum + m.content.split('\n').length, 0),
        languages: [...new Set(modules.map((m) => m.language))],
        durationMs,
      };

      await this.eventBus.publish('genesis-1.generation.completed', {
        id: crypto.randomUUID(),
        type: EventType.GenerationCompleted,
        source: 'generation-engine',
        correlationId: config.projectId,
        timestamp: new Date().toISOString(),
        projectId: config.projectId,
        payload: { stats },
        metadata: { version: 1, priority: 'normal' },
      });

      return { success: errors.length === 0, projectId: config.projectId, modules, errors, stats };
    } catch (error) {
      await this.eventBus.publish('genesis-1.generation.failed', {
        id: crypto.randomUUID(),
        type: EventType.GenerationFailed,
        source: 'generation-engine',
        correlationId: config.projectId,
        timestamp: new Date().toISOString(),
        projectId: config.projectId,
        payload: { error: (error as Error).message },
        metadata: { version: 1, priority: 'high' },
      });

      return {
        success: false,
        projectId: config.projectId,
        modules,
        errors: [...errors, (error as Error).message],
        stats: { totalFiles: 0, totalLines: 0, languages: [], durationMs: Date.now() - startedAt },
      };
    }
  }

  private generateForNode(
    node: { id: string; type: string; name: string; description?: string | null; runtime?: unknown; deployment?: unknown },
    edges: unknown[],
    config: GenerationConfig,
  ): GeneratedModule[] {
    const modules: GeneratedModule[] = [];

    switch (node.type) {
      case 'service':
        modules.push(this.generateBackendService(node, config));
        modules.push(this.generateServiceTest(node, config));
        break;
      case 'function':
        modules.push(this.generateFunction(node, config));
        break;
      case 'database':
        modules.push(this.generateDatabaseSchema(node, config));
        break;
      case 'api_gateway':
        modules.push(this.generateApiGateway(node, config));
        break;
      case 'rest_endpoint':
        modules.push(this.generateRestEndpoint(node, config));
        break;
      case 'page':
        modules.push(this.generatePage(node, config));
        break;
      case 'component':
        modules.push(this.generateComponent(node, config));
        break;
      case 'graphql_schema':
        modules.push(this.generateGraphQLSchema(node, config));
        break;
      case 'container':
        modules.push(this.generateDockerfile(node, config));
        break;
    }

    return modules;
  }

  private generateBackendService(
    node: { name: string; description?: string | null },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    const pascal = this.toPascal(node.name);

    switch (config.targetStack) {
      case 'laravel': return this.generateLaravelService(node, config);
      case 'django': return this.generateDjangoService(node, config);
      case 'golang': return this.generateGolangService(node, config);
      case 'rust': return this.generateRustService(node, config);
      case 'fastapi': return this.generateFastApiService(node, config);
      default:
        return {
          path: `${config.outputDir}/services/${name}/${name}.ts`,
          content: `export class ${pascal}Service {\n  constructor() {}\n  async healthCheck(): Promise<{ status: string }> {\n    return { status: 'healthy' };\n  }\n}`,
          language: 'typescript',
          type: 'service',
        };
    }
  }

  private generateFunction(
    node: { name: string },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/functions/${name}/index.ts`,
      content: `// Generated function: ${node.name}
export async function handler(event: unknown): Promise<{ statusCode: number; body: string }> {
  return { statusCode: 200, body: JSON.stringify({ message: 'ok' }) };
}`,
      language: 'typescript',
      type: 'service',
    };
  }

  private generateDatabaseSchema(
    node: { name: string },
    config: GenerationConfig,
  ): GeneratedModule {
    const tableName = this.toSnake(node.name);
    return {
      path: `${config.outputDir}/database/schema/${tableName}.ts`,
      content: `// Generated schema: ${node.name}
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const ${tableName} = pgTable('${tableName}', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});`,
      language: 'typescript',
      type: 'schema',
    };
  }

  private generateApiGateway(
    node: { name: string },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/gateway/${name}/routes.ts`,
      content: `// Generated API Gateway: ${node.name}
import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', gateway: '${node.name}' });
});

export default router;`,
      language: 'typescript',
      type: 'route',
    };
  }

  private generateRestEndpoint(
    node: { name: string },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/api/${name}.ts`,
      content: `// Generated endpoint: ${node.name}
import { z } from 'zod';

export const ${this.toCamel(node.name)}Schema = z.object({
  id: z.string().uuid(),
});

export async function GET() {
  return Response.json({ message: '${node.name}' });
}`,
      language: 'typescript',
      type: 'route',
    };
  }

  private generatePage(
    node: { name: string },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/pages/${name}.tsx`,
      content: `// Generated page: ${node.name}
export default function ${this.toPascal(node.name)}Page() {
  return (
    <div className="container mx-auto p-4">
      <h1>${node.name}</h1>
    </div>
  );
}`,
      language: 'tsx',
      type: 'component',
    };
  }

  private generateComponent(
    node: { name: string },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/components/${name}.tsx`,
      content: `// Generated component: ${node.name}
export function ${this.toPascal(node.name)}() {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold">${node.name}</h2>
    </div>
  );
}`,
      language: 'tsx',
      type: 'component',
    };
  }

  private generateDockerfile(
    node: { name: string; runtime?: unknown },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    const rt = (node.runtime as Record<string, unknown>) ?? {};
    return {
      path: `${config.outputDir}/docker/${name}.Dockerfile`,
      content: `# Generated Dockerfile: ${node.name}
FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE ${(rt.port as number) ?? 3000}
CMD ["node", "dist/index.js"]`,
      language: 'dockerfile',
      type: 'docker',
    };
  }

  private generateServiceTest(
    node: { name: string },
    config: GenerationConfig,
  ): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/services/${name}/__tests__/${name}.test.ts`,
      content: `// Generated test: ${node.name}
import { describe, it, expect } from 'vitest';
import { ${this.toPascal(node.name)}Service } from '../${name}';

describe('${this.toPascal(node.name)}Service', () => {
  it('should return healthy status', async () => {
    const service = new ${this.toPascal(node.name)}Service();
    const result = await service.healthCheck();
    expect(result.status).toBe('healthy');
  });
});`,
      language: 'typescript',
      type: 'test',
    };
  }

  // ── Stack-Specific Generators ─────────────────────────────

  private generateLaravelService(node: { name: string }, config: GenerationConfig): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/app/Services/${this.toPascal(node.name)}Service.php`,
      content: `<?php\n\nnamespace App\\Services;\n\nclass ${this.toPascal(node.name)}Service\n{\n    public function healthCheck(): array\n    {\n        return ['status' => 'healthy'];\n    }\n}`,
      language: 'php', type: 'service',
    };
  }

  private generateDjangoService(node: { name: string }, config: GenerationConfig): GeneratedModule {
    const name = this.toSnake(node.name);
    return {
      path: `${config.outputDir}/${name}/views.py`,
      content: `from rest_framework.views import APIView\nfrom rest_framework.response import Response\n\nclass ${this.toPascal(node.name)}View(APIView):\n    def get(self, request):\n        return Response({"status": "healthy"})`,
      language: 'python', type: 'service',
    };
  }

  private generateFastApiService(node: { name: string }, config: GenerationConfig): GeneratedModule {
    const name = this.toSnake(node.name);
    return {
      path: `${config.outputDir}/services/${name}.py`,
      content: `from fastapi import APIRouter\n\nrouter = APIRouter()\n\n@router.get("/health")\nasync def health_check():\n    return {"status": "healthy"}`,
      language: 'python', type: 'service',
    };
  }

  private generateGolangService(node: { name: string }, config: GenerationConfig): GeneratedModule {
    const name = this.toKebab(node.name);
    const pascal = this.toPascal(node.name);
    return {
      path: `${config.outputDir}/services/${name}/main.go`,
      content: `package main\n\nimport (\n\t"encoding/json"\n\t"net/http"\n)\n\ntype HealthResponse struct {\n\tStatus string \`json:"status"\`\n}\n\nfunc ${pascal}Handler(w http.ResponseWriter, r *http.Request) {\n\tw.Header().Set("Content-Type", "application/json")\n\tjson.NewEncoder(w).Encode(HealthResponse{Status: "healthy"})\n}`,
      language: 'go', type: 'service',
    };
  }

  private generateRustService(node: { name: string }, config: GenerationConfig): GeneratedModule {
    const name = this.toSnake(node.name);
    return {
      path: `${config.outputDir}/services/${name}/src/main.rs`,
      content: `use actix_web::{web, App, HttpServer, HttpResponse};\n\nasync fn health_check() -> HttpResponse {\n    HttpResponse::Ok().json(serde_json::json!({ "status": "healthy" }))\n}\n\n#[actix_web::main]\nasync fn main() -> std::io::Result<()> {\n    HttpServer::new(|| App::new().route("/health", web::get().to(health_check)))\n        .bind("127.0.0.1:3000")?\n        .run()\n        .await\n}`,
      language: 'rust', type: 'service',
    };
  }

  private generateGraphQLSchema(node: { name: string }, config: GenerationConfig): GeneratedModule {
    const name = this.toKebab(node.name);
    return {
      path: `${config.outputDir}/graphql/${name}.graphql`,
      content: `# Generated GraphQL schema: ${node.name}\ntype Query {\n  health: HealthStatus!\n}\n\ntype HealthStatus {\n  status: String!\n  timestamp: String!\n}`,
      language: 'graphql', type: 'schema',
    };
  }

  // ── Project Files ─────────────────────────────────────────
    nodes: Array<{ type: string; name: string }>,
    config: GenerationConfig,
  ): GeneratedModule[] {
    const modules: GeneratedModule[] = [];

    // package.json
    modules.push({
      path: `${config.outputDir}/package.json`,
      content: JSON.stringify(
        {
          name: `genesis-generated-${config.projectId.slice(0, 8)}`,
          version: '1.0.0',
          private: true,
          scripts: {
            dev: 'tsx watch src/index.ts',
            build: 'tsc',
            start: 'node dist/index.js',
            test: 'vitest run',
          },
        },
        null,
        2,
      ),
      language: 'json',
      type: 'config',
    });

    // README
    modules.push({
      path: `${config.outputDir}/README.md`,
      content: `# Generated Project: ${config.projectId}

Generated by Genesis-1 from graph topology.

## Architecture

${nodes.map((n) => `- **${n.type}**: ${n.name}`).join('\n')}

## Stack

Generated for: \`${config.targetStack}\`
`,
      language: 'markdown',
      type: 'docs',
    });

    // docker-compose.yml
    const services = nodes.filter((n) => ['service', 'database', 'cache', 'queue'].includes(n.type));
    if (services.length > 0) {
      modules.push({
        path: `${config.outputDir}/docker-compose.yml`,
        content: this.generateDockerCompose(services),
        language: 'yaml',
        type: 'config',
      });
    }

    // ── Observability ──────────────────────────────────────
    modules.push({
      path: `${config.outputDir}/monitoring/prometheus.yml`,
      content: this.generatePrometheusConfig(nodes, config),
      language: 'yaml',
      type: 'config',
    });
    modules.push({
      path: `${config.outputDir}/monitoring/grafana-dashboard.json`,
      content: this.generateGrafanaDashboard(nodes, config),
      language: 'json',
      type: 'config',
    });

    // ── Scalability Strategy ───────────────────────────────
    modules.push({
      path: `${config.outputDir}/docs/SCALABILITY.md`,
      content: this.generateScalabilityDoc(nodes, config),
      language: 'markdown',
      type: 'docs',
    });

    // ── Architecture Decision Records ──────────────────────
    modules.push({
      path: `${config.outputDir}/docs/ARCHITECTURE.md`,
      content: this.generateArchitectureDoc(nodes, config),
      language: 'markdown',
      type: 'docs',
    });

    // ── Analytics Setup ────────────────────────────────────
    modules.push({
      path: `${config.outputDir}/src/analytics.ts`,
      content: this.generateAnalyticsSetup(config),
      language: 'typescript',
      type: 'config',
    });

    // ── .env.example ───────────────────────────────────────
    modules.push({
      path: `${config.outputDir}/.env.example`,
      content: this.generateEnvExample(nodes, config),
      language: 'toml',
      type: 'config',
    });

    return modules;
  }

  // ── Observability Generators ────────────────────────────

  private generatePrometheusConfig(nodes: Array<{ type: string; name: string }>, config: GenerationConfig): string {
    const serviceTargets = nodes
      .filter((n) => ['service', 'function', 'api_gateway'].includes(n.type))
      .map((n) => `      - '${this.toKebab(n.name)}:3000'`)
      .join('\n');
    return `global:\n  scrape_interval: 15s\n  evaluation_interval: 15s\n\nscrape_configs:\n  - job_name: 'app'\n    metrics_path: '/metrics'\n    static_configs:\n      - targets:\n${serviceTargets || "      - 'app:3000'"}\n        labels:\n          environment: '${config.targetStack}'`;
  }

  private generateGrafanaDashboard(nodes: Array<{ type: string; name: string }>, config: GenerationConfig): string {
    return JSON.stringify({
      title: 'Genesis App Dashboard',
      uid: `genesis-${config.projectId.slice(0, 8)}`,
      panels: [
        { title: 'Request Rate', type: 'graph', targets: [{ expr: 'rate(http_requests_total[1m])' }] },
        { title: 'Error Rate', type: 'graph', targets: [{ expr: 'rate(http_requests_total{status=~"5.."}[5m])' }] },
        { title: 'Latency P95', type: 'graph', targets: [{ expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))' }] },
        { title: 'CPU Usage', type: 'graph', targets: [{ expr: 'rate(process_cpu_seconds_total[1m])' }] },
      ],
    }, null, 2);
  }

  // ── Documentation Generators ────────────────────────────

  private generateScalabilityDoc(nodes: Array<{ type: string; name: string }>, config: GenerationConfig): string {
    const services = nodes.filter((n) => ['service', 'function', 'api_gateway'].includes(n.type));
    return `# Scalability Strategy\n\n## Current Architecture\n${services.map((s) => `- **${s.type}**: ${s.name}`).join('\n')}\n\n## Scaling Recommendations\n\n### Horizontal Scaling\nEach service should support horizontal scaling with a minimum of 2 replicas for high availability.\n\n### Auto-Scaling\n- Target CPU utilization: 70%\n- Target memory utilization: 80%\n- Scale-out cooldown: 60 seconds\n- Scale-in cooldown: 300 seconds\n\n### Database Scaling\n- Use read replicas for read-heavy workloads\n- Implement connection pooling (min: 5, max: 50)\n- Consider sharding at >10M rows per table\n\n### Cache Strategy\n- Use Redis for session data and hot queries\n- Implement cache-aside pattern\n- Set TTL based on data freshness requirements\n\n### Bottleneck Mitigation\n- Monitor queue depth for async workloads\n- Set circuit breakers for external dependencies\n- Use CDN for static assets`;
  }

  private generateArchitectureDoc(nodes: Array<{ type: string; name: string }>, config: GenerationConfig): string {
    return `# Architecture Documentation\n\nGenerated by Genesis-1 from graph topology.\n\n## System Overview\n\nTarget Stack: \`${config.targetStack}\`\nGenerated: ${new Date().toISOString()}\n\n## Component Inventory\n\n${nodes.map((n) => `### ${n.name} (${n.type})\n- **Type**: ${n.type}\n- **Status**: Generated\n- **Stack**: ${config.targetStack}\n`).join('\n')}\n\n## Design Decisions\n\n1. **Graph-First Architecture**: The graph is the source of truth. Code is a compiled artifact.\n2. **Event-Driven Communication**: Services communicate via events for loose coupling.\n3. **Infrastructure as Code**: All infrastructure defined in version-controlled configs.\n4. **Observability by Default**: Prometheus metrics, structured logging, and health checks on every service.\n\n## Deployment\n\nSee \`docker-compose.yml\` and \`monitoring/\` directory for deployment configuration.\n\n## Evolution\n\nThis architecture can evolve by modifying the graph and regenerating. All generated code remains editable.`;
  }

  // ── Analytics Setup ─────────────────────────────────────

  private generateAnalyticsSetup(config: GenerationConfig): string {
    return `// Generated Analytics Setup — Genesis-1
// Provides structured event tracking for the generated application.

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: number;
}

class Analytics {
  private queue: AnalyticsEvent[] = [];
  private endpoint = process.env.ANALYTICS_ENDPOINT ?? '/api/analytics';

  track(name: string, properties?: Record<string, string | number | boolean>): void {
    this.queue.push({ name, properties, timestamp: Date.now() });
    if (this.queue.length >= 10) this.flush();
  }

  private async flush(): Promise<void> {
    const batch = this.queue.splice(0);
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
    } catch {
      // Re-queue on failure (up to 100 events)
      if (this.queue.length < 100) this.queue.unshift(...batch);
    }
  }

  // Auto-flush every 30 seconds
  constructor() {
    setInterval(() => { if (this.queue.length > 0) this.flush(); }, 30000);
  }
}

export const analytics = new Analytics();

// Track key events
export const trackPageView = (page: string) => analytics.track('page_view', { page });
export const trackApiCall = (endpoint: string, duration: number, status: number) =>
  analytics.track('api_call', { endpoint, duration, status });
export const trackError = (message: string, context?: string) =>
  analytics.track('error', { message, context: context ?? 'unknown' });`;
  }

  // ── Env Example ─────────────────────────────────────────

  private generateEnvExample(nodes: Array<{ type: string; name: string }>, config: GenerationConfig): string {
    const hasDb = nodes.some((n) => n.type === 'database');
    const hasCache = nodes.some((n) => n.type === 'cache');
    const hasQueue = nodes.some((n) => n.type === 'queue');
    return `# Generated Environment — ${config.targetStack}
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
${hasDb ? 'DATABASE_URL=postgres://user:password@localhost:5432/app\nDATABASE_POOL_MIN=2\nDATABASE_POOL_MAX=20\n' : ''}${hasCache ? 'REDIS_URL=redis://localhost:6379\n' : ''}${hasQueue ? 'QUEUE_REDIS_URL=redis://localhost:6379/1\n' : ''}
# Observability
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true

# Analytics
ANALYTICS_ENDPOINT=/api/analytics`;
  }

  private generateDockerCompose(services: Array<{ type: string; name: string }>): string {
    const entries = services
      .map(
        (svc) => `  ${this.toKebab(svc.name)}:
    build: ./${this.toKebab(svc.name)}
    ports:
      - "3000:3000"`,
      )
      .join('\n\n');

    return `version: '3.8'
services:
${entries}`;
  }

  // ── Name helpers ────────────────────────────────────────────

  private toKebab(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  private toPascal(s: string): string {
    return s
      .split(/[\s-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }
  private toCamel(s: string): string {
    const pascal = this.toPascal(s);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
  private toSnake(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }
}
