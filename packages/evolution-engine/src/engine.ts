import type { GraphEngine } from '@genesis-1/graph-engine';
import type { EventPublisher } from '@genesis-1/event-bus';
import type { GraphNode, GraphEdge, GraphSnapshot } from '@genesis-1/shared';
import type { DatabaseClient } from '@genesis-1/database';
import { ArchitectureMemory } from './memory';
import type { PersistenceProvider } from './memory';
import { TemplateRegistry } from './templates';
import { SelfHealer } from './self-healer';
import { DrizzlePersistenceProvider } from './persistence';

// ── Types ─────────────────────────────────────────────────────

export interface EvolutionConfig {
  projectId: string;
  enableSelfHealing: boolean;
  enableAutoUpgrade: boolean;
  enableInsights: boolean;
  targetArchitecturePattern?: string;
}

export interface EvolutionResult {
  projectId: string;
  insights: ArchitectureInsight[];
  upgradePaths: UpgradePath[];
  appliedFixes: SelfHealAction[];
  templateMatches: TemplateMatch[];
  snapshotId: string;
}

export interface ArchitectureInsight {
  id: string;
  type: 'optimization' | 'security' | 'scalability' | 'maintainability' | 'cost' | 'evolution';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  affectedNodes: string[];
  suggestion: string;
  autoFixAvailable: boolean;
  confidence: number;
}

export interface UpgradePath {
  id: string;
  name: string;
  description: string;
  fromVersion: string;
  toVersion: string;
  steps: UpgradeStep[];
  estimatedEffortMinutes: number;
  risk: 'low' | 'medium' | 'high';
  automated: boolean;
}

export interface UpgradeStep {
  order: number;
  action: 'add_node' | 'remove_node' | 'add_edge' | 'remove_edge' | 'update_config' | 'run_migration' | 'validate';
  description: string;
  nodeId?: string;
  edgeId?: string;
  config?: Record<string, unknown>;
  rollback?: string;
}

export interface SelfHealAction {
  id: string;
  type: 'fix_cycle' | 'add_missing_dependency' | 'remove_orphan' | 'fix_port' | 'add_runtime_config';
  description: string;
  nodeId?: string;
  edgeId?: string;
  applied: boolean;
  success: boolean;
}

export interface TemplateMatch {
  templateId: string;
  templateName: string;
  matchScore: number;
  matchedNodes: string[];
  suggestedAdditions: string[];
}

export interface LearnedPattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  lastSeenAt: number;
  nodeTypes: string[];
  edgeTypes: string[];
  typicalInsights: string[];
}

// ── Engine ────────────────────────────────────────────────────

export class EvolutionEngine {
  private memory: ArchitectureMemory;
  private templates: TemplateRegistry;
  private selfHealer: SelfHealer;

  constructor(
    private readonly graphEngine: GraphEngine,
    private readonly eventBus: EventPublisher,
    db?: DatabaseClient,
  ) {
    this.memory = new ArchitectureMemory();
    this.templates = new TemplateRegistry();
    this.selfHealer = new SelfHealer(graphEngine);

    if (db) {
      const persistence = new DrizzlePersistenceProvider(db);
      this.memory.setPersistence(persistence);
    }
  }

  async evolve(config: EvolutionConfig): Promise<EvolutionResult> {
    // 1. Snapshot current state
    const snapshot = await this.graphEngine.createSnapshot(config.projectId, `evolution-${Date.now()}`);
    const { data: nodes } = await this.graphEngine.listNodes(config.projectId);
    const edges = await this.graphEngine.listEdges(config.projectId);

    // 2. Generate insights
    const insights = config.enableInsights ? await this.analyzeArchitecture(nodes, edges, config.projectId) : [];

    // 3. Find upgrade paths
    const upgradePaths = config.enableAutoUpgrade ? await this.findUpgradePaths(nodes, edges, config) : [];

    // 4. Self-healing
    const appliedFixes = config.enableSelfHealing ? await this.selfHealer.heal(nodes, edges, config.projectId) : [];

    // 5. Template matching
    const templateMatches = await this.templates.match(nodes, edges);

    // 6. Store in memory for future learning
    await this.memory.record({ projectId: config.projectId, timestamp: Date.now(), nodeCount: nodes.length, edgeCount: edges.length, insights, templateMatches });

    // 7. Learn patterns from accumulated memory
    const learned = await this.memory.learnPatterns();
    // Persisted via DrizzlePersistenceProvider if db is configured

    return {
      projectId: config.projectId,
      insights,
      upgradePaths,
      appliedFixes,
      templateMatches,
      snapshotId: snapshot.id,
    };
  }

  // ── Analysis ────────────────────────────────────────────────

  async analyzeArchitecture(
    nodes: GraphNode[],
    edges: GraphEdge[],
    projectId: string,
  ): Promise<ArchitectureInsight[]> {
    const insights: ArchitectureInsight[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // 1. Monolith detection
    const serviceNodes = nodes.filter((n) => ['service', 'function'].includes(n.type));
    if (serviceNodes.length === 1 && nodes.length > 5) {
      insights.push({
        id: `insight-monolith-${projectId}`,
        type: 'evolution',
        title: 'Monolith Detected',
        description: `Single service "${serviceNodes[0]!.name}" handles ${nodes.length} components. Consider splitting into bounded contexts.`,
        severity: 'warning',
        affectedNodes: [serviceNodes[0]!.id],
        suggestion: 'Split into multiple services organized by bounded context. Introduce an API gateway for routing.',
        autoFixAvailable: false,
        confidence: 0.85,
      });
    }

    // 2. Missing cache layer
    const dbs = nodes.filter((n) => n.type === 'database');
    const caches = nodes.filter((n) => n.type === 'cache');
    if (dbs.length > 0 && caches.length === 0) {
      insights.push({
        id: `insight-no-cache-${projectId}`,
        type: 'optimization',
        title: 'No Caching Layer',
        description: `${dbs.length} database(s) with no cache. Adding a cache can reduce DB load by 40-80%.`,
        severity: 'warning',
        affectedNodes: dbs.map((d) => d.id),
        suggestion: 'Add a Redis cache node and connect read-heavy services to it.',
        autoFixAvailable: false,
        confidence: 0.9,
      });
    }

    // 3. No observability
    const hasMonitoring = nodes.some((n) => n.type === 'prompt_template' || (n.runtime as Record<string, unknown>)?.monitoring);
    if (!hasMonitoring && nodes.length > 3) {
      insights.push({
        id: `insight-no-observability-${projectId}`,
        type: 'maintainability',
        title: 'No Observability Configured',
        description: 'No monitoring, logging, or tracing detected. Critical for production systems.',
        severity: 'warning',
        affectedNodes: serviceNodes.map((s) => s.id),
        suggestion: 'Add Prometheus metrics endpoints and structured logging. Consider OpenTelemetry for tracing.',
        autoFixAvailable: false,
        confidence: 0.95,
      });
    }

    // 4. High fan-in to single database
    for (const db of dbs) {
      const incomingEdges = edges.filter((e) => e.target === db.id);
      if (incomingEdges.length > 5) {
        insights.push({
          id: `insight-high-fan-in-${db.id}`,
          type: 'scalability',
          title: `High Fan-In to "${db.name}"`,
          description: `${incomingEdges.length} services directly connect to this database. Consider a data service layer or CQRS pattern.`,
          severity: 'warning',
          affectedNodes: [db.id],
          suggestion: 'Introduce a dedicated data service or implement CQRS with read replicas.',
          autoFixAvailable: false,
          confidence: 0.75,
        });
      }
    }

    // 5. Missing health checks
    for (const svc of serviceNodes) {
      const rt = svc.runtime as Record<string, unknown> | null;
      if (!rt || !rt.healthCheck) {
        insights.push({
          id: `insight-no-healthcheck-${svc.id}`,
          type: 'maintainability',
          title: `No Health Check for "${svc.name}"`,
          description: 'Service has no health check configured. This prevents automatic recovery on failure.',
          severity: 'info',
          affectedNodes: [svc.id],
          suggestion: 'Add a /health endpoint and configure Kubernetes liveness/readiness probes.',
          autoFixAvailable: true,
          confidence: 1.0,
        });
      }
    }

    // 6. Missing API gateway
    const hasGateway = nodes.some((n) => n.type === 'api_gateway' || n.type === 'load_balancer');
    if (!hasGateway && serviceNodes.length > 2) {
      insights.push({
        id: `insight-no-gateway-${projectId}`,
        type: 'evolution',
        title: 'No API Gateway',
        description: 'Multiple services exposed without an API gateway. This complicates routing, auth, and rate limiting.',
        severity: 'warning',
        affectedNodes: serviceNodes.map((s) => s.id),
        suggestion: 'Add an API Gateway (e.g., Kong, NGINX, AWS API Gateway) to centralize cross-cutting concerns.',
        autoFixAvailable: false,
        confidence: 0.8,
      });
    }

    // 7. Cost optimization for small services
    if (nodes.length < 5 && nodes.some((n) => n.type === 'cluster')) {
      insights.push({
        id: `insight-overprovision-${projectId}`,
        type: 'cost',
        title: 'Possible Over-Provisioning',
        description: 'Kubernetes cluster detected for a small architecture. Consider serverless or ECS Fargate to reduce cost.',
        severity: 'info',
        affectedNodes: nodes.filter((n) => n.type === 'cluster').map((n) => n.id),
        suggestion: 'Evaluate serverless options or use ECS Fargate for simpler deployments.',
        autoFixAvailable: false,
        confidence: 0.6,
      });
    }

    return insights;
  }

  async findUpgradePaths(
    nodes: GraphNode[],
    edges: GraphEdge[],
    config: EvolutionConfig,
  ): Promise<UpgradePath[]> {
    const paths: UpgradePath[] = [];

    // Check if migrations are needed based on current state
    const serviceNodes = nodes.filter((n) => ['service', 'function'].includes(n.type));
    const hasContainer = nodes.some((n) => n.type === 'container');

    // Path: Dockerize services
    if (serviceNodes.length > 0 && !hasContainer) {
      paths.push({
        id: 'upgrade-dockerize',
        name: 'Containerize Services',
        description: 'Wrap services in Docker containers for consistent deployment',
        fromVersion: 'current',
        toVersion: 'containerized',
        steps: serviceNodes.map((svc, i) => ({
          order: i + 1,
          action: 'add_node' as const,
          description: `Create container wrapper for ${svc.name}`,
          nodeId: svc.id,
          config: { containerType: 'docker', baseImage: 'node:20-alpine' },
        })),
        estimatedEffortMinutes: serviceNodes.length * 15,
        risk: 'low',
        automated: true,
      });
    }

    // Path: Add monitoring
    paths.push({
      id: 'upgrade-monitoring',
      name: 'Add Observability Stack',
      description: 'Add Prometheus, Grafana, and structured logging',
      fromVersion: 'current',
      toVersion: 'observable',
      steps: [
        { order: 1, action: 'add_node', description: 'Add Prometheus metrics endpoint' },
        { order: 2, action: 'add_node', description: 'Add Grafana dashboards' },
        { order: 3, action: 'update_config', description: 'Configure alerting rules' },
      ],
      estimatedEffortMinutes: 60,
      risk: 'low',
      automated: true,
    });

    return paths;
  }
}
