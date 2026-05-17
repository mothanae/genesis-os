import type { DatabaseClient } from '@genesis-1/database';
import type { EventPublisher } from '@genesis-1/event-bus';
import type { GraphEngine } from '@genesis-1/graph-engine';
import type { RuleEngine } from '@genesis-1/rule-engine';
import type { LLMProvider } from './providers/ollama';
import { EventType } from '@genesis-1/shared';

// ── Task Types ─────────────────────────────────────────────────

export interface OrchestrationTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  agentId: string | null;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  dependencies: string[];
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type TaskType =
  | 'plan'
  | 'generate_frontend'
  | 'generate_backend'
  | 'generate_api'
  | 'generate_database'
  | 'generate_infra'
  | 'validate'
  | 'simulate'
  | 'deploy'
  | 'document';

export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

// ── Agent Types ────────────────────────────────────────────────

export interface AgentSpec {
  id: string;
  name: string;
  type: TaskType;
  description: string;
  capabilities: string[];
  requiredTools: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

// ── Orchestrator Config ───────────────────────────────────────

export interface OrchestratorConfig {
  db: DatabaseClient;
  eventBus: EventPublisher;
  graphEngine: GraphEngine;
  ruleEngine: RuleEngine;
  llmProvider?: LLMProvider;
  maxConcurrentTasks?: number;
  maxRetries?: number;
}

// ── Agent Registry ─────────────────────────────────────────────

const AGENT_REGISTRY: AgentSpec[] = [
  {
    id: 'planner-agent',
    name: 'Architecture Planner',
    type: 'plan',
    description: 'Analyzes graph topology and creates task execution plans',
    capabilities: ['graph_analysis', 'task_planning', 'dependency_resolution', 'sequencing'],
    requiredTools: ['graph-query', 'rule-evaluate'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'frontend-agent',
    name: 'Frontend Generator',
    type: 'generate_frontend',
    description: 'Generates React/Next.js frontend code from graph specifications',
    capabilities: ['react_generation', 'component_generation', 'routing', 'state_management', 'styling'],
    requiredTools: ['graph-query', 'code-exec', 'web-search'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'backend-agent',
    name: 'Backend Generator',
    type: 'generate_backend',
    description: 'Generates Node.js/Fastify backend code from graph specifications',
    capabilities: ['api_generation', 'service_generation', 'middleware', 'auth'],
    requiredTools: ['graph-query', 'code-exec'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'api-agent',
    name: 'API Generator',
    type: 'generate_api',
    description: 'Generates REST/GraphQL/gRPC API definitions from graph endpoints',
    capabilities: ['rest_generation', 'graphql_generation', 'grpc_generation', 'openapi'],
    requiredTools: ['graph-query', 'code-exec'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'database-agent',
    name: 'Database Generator',
    type: 'generate_database',
    description: 'Generates database schemas and migrations from graph data nodes',
    capabilities: ['schema_generation', 'migration_generation', 'index_optimization'],
    requiredTools: ['graph-query', 'code-exec'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'infra-agent',
    name: 'Infrastructure Generator',
    type: 'generate_infra',
    description: 'Generates Docker, Kubernetes, and Terraform configs from graph deployment specs',
    capabilities: ['docker_generation', 'kubernetes_generation', 'terraform_generation', 'ci_cd'],
    requiredTools: ['graph-query', 'code-exec', 'simulation-run'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'validate-agent',
    name: 'Architecture Validator',
    type: 'validate',
    description: 'Validates generated code against graph topology and rules',
    capabilities: ['topology_validation', 'rule_evaluation', 'security_check', 'performance_check'],
    requiredTools: ['graph-query', 'rule-evaluate'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'simulate-agent',
    name: 'Runtime Simulator',
    type: 'simulate',
    description: 'Simulates generated systems before deployment',
    capabilities: ['load_testing', 'failure_simulation', 'latency_analysis', 'bottleneck_detection'],
    requiredTools: ['graph-query', 'simulation-run'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'deploy-agent',
    name: 'Deployment Agent',
    type: 'deploy',
    description: 'Orchestrates deployment to target environments',
    capabilities: ['deployment', 'rollback', 'health_check', 'monitoring_setup'],
    requiredTools: ['graph-query', 'code-exec', 'simulation-run'],
    inputSchema: {},
    outputSchema: {},
  },
  {
    id: 'document-agent',
    name: 'Documentation Generator',
    type: 'document',
    description: 'Generates architecture documentation, API docs, and system diagrams',
    capabilities: ['architecture_docs', 'api_docs', 'deployment_docs', 'runbook_generation'],
    requiredTools: ['graph-query'],
    inputSchema: {},
    outputSchema: {},
  },
];

// ── Orchestrator ──────────────────────────────────────────────

export class AgentOrchestrator {
  private tasks: Map<string, OrchestrationTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private maxConcurrent: number;
  private maxRetries: number;

  constructor(private readonly config: OrchestratorConfig) {
    this.maxConcurrent = config.maxConcurrentTasks ?? 4;
    this.maxRetries = config.maxRetries ?? 3;
  }

  // ── Planning ───────────────────────────────────────────────

  /**
   * Analyze a project's graph topology and produce an execution plan.
   * The planner agent examines the graph structure and determines what needs to be built.
   */
  async planFromGraph(projectId: string, userId?: string): Promise<OrchestrationTask[]> {
    // 1. Load graph topology
    const { data: allNodes } = await this.config.graphEngine.listNodes(projectId);
    const allEdges = await this.config.graphEngine.listEdges(projectId);
    const topologyValidation = await this.config.graphEngine.validateTopology(projectId);

    // 2. Categorize nodes by what needs to be generated
    const categories = this.categorizeNodes(allNodes);

    const plan: OrchestrationTask[] = [];

    // 3. Generate plan task first (always)
    const planTask = this.createTask('plan', { projectId, nodeCount: allNodes.length, edgeCount: allEdges.length, categories, topologyValidation });
    plan.push(planTask);

    // 4. Database tasks
    if (categories.databases.length > 0) {
      const dbTask = this.createTask('generate_database', { databases: categories.databases }, [planTask.id]);
      plan.push(dbTask);
    }

    // 5. Backend tasks (services, functions)
    if (categories.backendServices.length > 0) {
      const backendTask = this.createTask('generate_backend', { services: categories.backendServices }, [planTask.id]);
      plan.push(backendTask);
    }

    // 6. API tasks (endpoints, gateways)
    if (categories.apiNodes.length > 0) {
      const apiTask = this.createTask('generate_api', { apiNodes: categories.apiNodes }, [planTask.id]);
      plan.push(apiTask);
    }

    // 7. Frontend tasks (pages, components)
    if (categories.frontendNodes.length > 0) {
      const frontendTask = this.createTask('generate_frontend', { frontendNodes: categories.frontendNodes }, [planTask.id]);
      plan.push(frontendTask);
    }

    // 8. Infrastructure tasks
    if (categories.infraNodes.length > 0 || categories.backendServices.length > 0) {
      const infraTask = this.createTask('generate_infra', { infraNodes: categories.infraNodes, services: categories.backendServices }, [
        backendTasks(plan)?.id ?? planTask.id,
      ]);
      plan.push(infraTask);
    }

    // 9. Validation task (depends on all generation tasks)
    const generationTasks = plan.filter((t) => t.type.startsWith('generate_'));
    const validateTask = this.createTask('validate', { projectId, planTaskIds: generationTasks.map((t) => t.id) }, generationTasks.map((t) => t.id));
    plan.push(validateTask);

    // 10. Documentation task (parallel to validation)
    if (categories.hasDocumentableNodes(allNodes)) {
      const docTask = this.createTask('document', { projectId, nodes: allNodes.map((n) => ({ id: n.id, name: n.name, type: n.type })) }, generationTasks.map((t) => t.id));
      plan.push(docTask);
    }

    // Store all tasks
    for (const task of plan) {
      this.tasks.set(task.id, task);
    }

    // Publish plan
    await this.config.eventBus.publish('genesis-1.agent.started', {
      id: crypto.randomUUID(),
      type: EventType.AgentStarted,
      source: 'agent-orchestrator',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      projectId,
      userId,
      payload: { taskCount: plan.length, taskTypes: plan.map((t) => t.type) },
      metadata: { version: 1, priority: 'normal' },
    });

    return plan;
  }

  // ── Execution ──────────────────────────────────────────────

  /**
   * Execute the plan — run tasks in dependency order.
   */
  async executePlan(projectId: string, userId?: string): Promise<OrchestrationTask[]> {
    const plan = await this.planFromGraph(projectId, userId);
    const results: OrchestrationTask[] = [];

    // Execution loop
    while (this.hasRemainingTasks()) {
      const readyTasks = this.getReadyTasks();

      // Run ready tasks (up to maxConcurrent)
      const batch = readyTasks.slice(0, this.maxConcurrent - this.runningTasks.size);

      if (batch.length === 0 && this.runningTasks.size === 0) {
        // Check for deadlock: remaining tasks with blocked dependencies
        const pending = this.getPendingTasks();
        if (pending.length > 0) {
          for (const task of pending) {
            const deps = task.dependencies.map((d) => this.tasks.get(d));
            const allDepsFailed = deps.every((d) => d?.status === 'failed');
            if (allDepsFailed) {
              task.status = 'cancelled';
              task.error = 'All dependencies failed';
            }
          }
          break;
        }
        break;
      }

      // Execute batch
      const batchPromises = batch.map((task) => this.executeTask(task, projectId, userId));
      const batchResults = await Promise.allSettled(batchPromises);

      for (let i = 0; i < batch.length; i++) {
        const result = batchResults[i]!;
        const task = batch[i]!;
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          task.status = 'failed';
          task.error = (result.reason as Error).message;
          results.push(task);
        }
      }
    }

    return results;
  }

  // ── Agent Selection ─────────────────────────────────────────

  selectAgent(taskType: TaskType): AgentSpec | null {
    return AGENT_REGISTRY.find((a) => a.type === taskType) ?? null;
  }

  listAgents(): AgentSpec[] {
    return [...AGENT_REGISTRY];
  }

  getAgent(agentId: string): AgentSpec | null {
    return AGENT_REGISTRY.find((a) => a.id === agentId) ?? null;
  }

  // ── Task Execution ──────────────────────────────────────────

  private async executeTask(
    task: OrchestrationTask,
    projectId: string,
    userId?: string,
  ): Promise<OrchestrationTask> {
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    this.runningTasks.add(task.id);

    const agent = this.selectAgent(task.type);

    try {
      // Publish agent started
      await this.config.eventBus.publish('genesis-1.agent.started', {
        id: crypto.randomUUID(),
        type: EventType.AgentStarted,
        source: agent?.id ?? 'unknown',
        correlationId: task.id,
        timestamp: new Date().toISOString(),
        projectId,
        userId,
        payload: { taskId: task.id, taskType: task.type, agentId: agent?.id },
        metadata: { version: 1, priority: 'normal' },
      });

      // Execute the agent's work (stub — actual implementation ties to LLM/generation)
      const output = await this.dispatchAgent(agent, task, projectId);

      task.status = 'completed';
      task.output = output;
      task.completedAt = new Date().toISOString();

      await this.config.eventBus.publish('genesis-1.agent.completed', {
        id: crypto.randomUUID(),
        type: EventType.AgentCompleted,
        source: agent?.id ?? 'unknown',
        correlationId: task.id,
        timestamp: new Date().toISOString(),
        projectId,
        userId,
        payload: { taskId: task.id, taskType: task.type, output },
        metadata: { version: 1, priority: 'normal' },
      });
    } catch (error) {
      task.retries++;
      if (task.retries < task.maxRetries) {
        task.status = 'pending';
      } else {
        task.status = 'failed';
        task.error = (error as Error).message;

        await this.config.eventBus.publish('genesis-1.agent.failed', {
          id: crypto.randomUUID(),
          type: EventType.AgentFailed,
          source: agent?.id ?? 'unknown',
          correlationId: task.id,
          timestamp: new Date().toISOString(),
          projectId,
          userId,
          payload: { taskId: task.id, error: task.error, retries: task.retries },
          metadata: { version: 1, priority: 'high' },
        });
      }
    } finally {
      this.runningTasks.delete(task.id);
    }

    return task;
  }

  /**
   * Dispatch to the appropriate agent implementation.
   * Each agent reads from the graph engine and produces a structured output.
   */
  private async dispatchAgent(
    agent: AgentSpec | null,
    task: OrchestrationTask,
    projectId: string,
  ): Promise<Record<string, unknown>> {
    switch (task.type) {
      case 'plan':
        return this.planAgent(projectId, task);

      case 'generate_database':
        return this.databaseAgent(projectId, task);

      case 'generate_backend':
        return this.backendAgent(projectId, task);

      case 'generate_api':
        return this.apiAgent(projectId, task);

      case 'generate_frontend':
        return this.frontendAgent(projectId, task);

      case 'generate_infra':
        return this.infraAgent(projectId, task);

      case 'validate':
        return this.validateAgent(projectId, task);

      case 'simulate':
        return this.simulateAgent(projectId, task);

      case 'deploy':
        return this.deployAgent(projectId, task);

      case 'document':
        return this.documentAgent(projectId, task);

      default:
        return { done: true, message: `No handler for task type: ${task.type}` };
    }
  }

  // ── Agent Implementations ────────────────────────────────────

  private async planAgent(projectId: string, task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);
    const edges = await this.config.graphEngine.listEdges(projectId);
    const topologyValidation = await this.config.graphEngine.validateTopology(projectId);

    const categories = this.categorizeNodes(nodes);
    const phases: string[] = [];

    if (categories.databases.length > 0) phases.push('generate_database');
    if (categories.backendServices.length > 0) phases.push('generate_backend');
    if (categories.apiNodes.length > 0) phases.push('generate_api');
    if (categories.frontendNodes.length > 0) phases.push('generate_frontend');
    if (categories.infraNodes.length > 0 || categories.backendServices.length > 0) phases.push('generate_infra');
    phases.push('validate');
    if (categories.hasDocumentableNodes(nodes)) phases.push('document');

    const totalNodeTypes = new Set(nodes.map((n) => n.type)).size;
    const estimatedComplexity =
      nodes.length > 50 ? 'high' : nodes.length > 20 ? 'medium' : 'low';

    return {
      plan: {
        totalTasks: this.tasks.size,
        phases,
        estimatedComplexity,
        topologySummary: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          nodeTypeCount: totalNodeTypes,
          categories: Object.fromEntries(
            Object.entries(categories).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]),
          ),
        },
        topologyValidation: {
          valid: topologyValidation.valid,
          errors: topologyValidation.errors?.slice(0, 10),
          warnings: topologyValidation.warnings?.slice(0, 10),
        },
      },
    };
  }

  private async databaseAgent(projectId: string, task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);
    const dbNodes = nodes.filter((n) =>
      ['database', 'cache', 'queue', 'event_store', 'object_store'].includes(n.type),
    );

    const schemas = dbNodes.map((n) => ({
      tableName: n.name.toLowerCase().replace(/\s+/g, '_'),
      nodeType: n.type,
      columns: this.inferColumnsFromNode(n),
    }));

    return {
      schemasGenerated: schemas.length,
      schemas,
      migrationsGenerated: schemas.length > 0,
      ormUsed: 'drizzle',
      targetDialect: 'postgresql',
    };
  }

  private async backendAgent(projectId: string, task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);
    const edges = await this.config.graphEngine.listEdges(projectId);

    const services = nodes.filter((n) =>
      ['service', 'function'].includes(n.type),
    );

    const serviceSpecs = services.map((s) => {
      const relatedEdges = edges.filter(
        (e) => e.source === s.id || e.target === s.id,
      );
      return {
        name: s.name,
        type: s.type,
        dependencies: relatedEdges.map((e) =>
          e.source === s.id ? e.target : e.source,
        ),
        runtimeConfig: s.runtime,
      };
    });

    return {
      servicesGenerated: serviceSpecs.length,
      services: serviceSpecs,
      routesGenerated: services.length > 0,
      middlewareGenerated: services.length > 0,
    };
  }

  private async apiAgent(projectId: string, task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);
    const edges = await this.config.graphEngine.listEdges(projectId);

    const apiNodes = nodes.filter((n) =>
      ['api_gateway', 'rest_endpoint', 'graphql_schema', 'grpc_service', 'webhook'].includes(n.type),
    );

    const endpoints = apiNodes.map((n) => {
      const outEdges = edges.filter((e) => e.source === n.id);
      return {
        path: `/${n.name.toLowerCase().replace(/\s+/g, '-')}`,
        method: n.type === 'graphql_schema' ? 'POST' : n.type === 'webhook' ? 'POST' : 'GET',
        type: n.type,
        description: n.description ?? '',
        connectedServices: outEdges.map((e) => e.target),
      };
    });

    return {
      endpointsGenerated: endpoints.length,
      endpoints,
      openApiGenerated: endpoints.length > 0,
      specVersion: '3.1.0',
    };
  }

  private async frontendAgent(projectId: string, task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);
    const edges = await this.config.graphEngine.listEdges(projectId);

    const frontendNodes = nodes.filter((n) =>
      ['page', 'component', 'form', 'table', 'chart'].includes(n.type),
    );

    const components = frontendNodes.map((n) => {
      const dataDeps = edges.filter((e) => e.source === n.id);
      return {
        name: n.name,
        type: n.type,
        route: n.type === 'page' ? `/${n.name.toLowerCase().replace(/\s+/g, '-')}` : undefined,
        dataDependencies: dataDeps.map((e) => e.target),
      };
    });

    // Build routing tree from page nodes
    const pages = components.filter((c) => c.type === 'page');
    const routeTree = pages.map((p) => ({
      path: p.route ?? '/',
      component: p.name,
    }));

    return {
      componentsGenerated: components.length,
      components,
      pagesGenerated: pages.length,
      routeTree,
      routingConfigured: pages.length > 0,
    };
  }

  private async infraAgent(projectId: string, task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);

    const infraNodes = nodes.filter((n) =>
      ['environment', 'region', 'cluster', 'namespace', 'load_balancer', 'dns', 'container', 'pod'].includes(n.type),
    );

    const hasServices = nodes.some((n) => ['service', 'function'].includes(n.type));
    const hasDb = nodes.some((n) => n.type === 'database');

    return {
      infrastructure: {
        environments: infraNodes.filter((n) => n.type === 'environment').map((n) => n.name),
        regions: infraNodes.filter((n) => n.type === 'region').map((n) => n.name),
        clusters: infraNodes.filter((n) => n.type === 'cluster').map((n) => n.name),
      },
      dockerfilesGenerated: hasServices,
      kubernetesManifestsGenerated: hasServices,
      terraformModulesGenerated: hasServices || hasDb,
      cicdPipelineGenerated: hasServices,
    };
  }

  private async validateAgent(projectId: string, _task: OrchestrationTask): Promise<Record<string, unknown>> {
    const topologyValidation = await this.config.graphEngine.validateTopology(projectId);

    const ruleViolations = await this.config.ruleEngine.getViolations(projectId);

    return {
      valid: topologyValidation.valid && ruleViolations.length === 0,
      topology: {
        valid: topologyValidation.valid,
        errors: topologyValidation.errors ?? [],
        warnings: topologyValidation.warnings ?? [],
      },
      rules: {
        violations: ruleViolations.length,
        details: ruleViolations.slice(0, 20),
      },
      checksPassed: (topologyValidation.valid ? 1 : 0) + (ruleViolations.length === 0 ? 1 : 0),
      errors: (topologyValidation.errors?.length ?? 0) + ruleViolations.length,
      warnings: topologyValidation.warnings?.length ?? 0,
    };
  }

  private async simulateAgent(projectId: string, task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);

    const serviceCount = nodes.filter((n) => ['service', 'function', 'container'].includes(n.type)).length;
    const dbCount = nodes.filter((n) => n.type === 'database').length;

    return {
      simulationConfig: {
        projectId,
        serviceCount,
        databaseCount: dbCount,
        suggestedDuration: 60000,
        suggestedTickInterval: 100,
        generators: [
          { type: 'http_traffic', enabled: serviceCount > 0 },
          { type: 'db_queries', enabled: dbCount > 0 },
          { type: 'events', enabled: true },
          { type: 'auth', enabled: true },
          { type: 'background_jobs', enabled: serviceCount > 0 },
          { type: 'websocket', enabled: serviceCount > 0 },
        ],
        loadProfile: {
          type: 'ramp',
          baseRps: 10,
          peakRps: serviceCount * 50,
          rampDurationTicks: 100,
        },
      },
      estimatedMetrics: {
        avgLatency: `${20 + serviceCount * 5}ms`,
        throughput: `${serviceCount * 100} req/s`,
        availability: '99.95%',
      },
    };
  }

  private async deployAgent(projectId: string, _task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);

    const hasServices = nodes.some((n) => ['service', 'function', 'container'].includes(n.type));
    const hasK8s = nodes.some((n) => ['cluster', 'namespace'].includes(n.type));
    const regions = nodes.filter((n) => n.type === 'region').map((n) => n.name);

    return {
      deploymentPlan: {
        target: hasK8s ? 'kubernetes' : 'docker-compose',
        regions: regions.length > 0 ? regions : ['us-east-1'],
        services: nodes.filter((n) => ['service', 'function'].includes(n.type)).map((n) => n.name),
        strategy: hasServices ? 'rolling' : 'none',
        healthCheckEnabled: hasServices,
      },
      rollbackConfigured: true,
    };
  }

  private async documentAgent(projectId: string, _task: OrchestrationTask): Promise<Record<string, unknown>> {
    const { data: nodes } = await this.config.graphEngine.listNodes(projectId);
    const edges = await this.config.graphEngine.listEdges(projectId);

    const architectureOverview = this.generateArchitectureOverview(nodes, edges);
    const apiEndpoints = nodes
      .filter((n) => ['rest_endpoint', 'graphql_schema', 'grpc_service', 'webhook'].includes(n.type))
      .map((n) => ({
        name: n.name,
        type: n.type,
        description: n.description ?? '',
      }));

    const sections = ['architecture'];
    if (apiEndpoints.length > 0) sections.push('api');
    if (nodes.some((n) => ['container', 'pod', 'cluster'].includes(n.type))) sections.push('deployment');
    sections.push('runbook');

    return {
      docsGenerated: true,
      sections,
      format: 'markdown',
      architectureOverview,
      apiEndpoints,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Agent Helper Methods ─────────────────────────────────────

  private inferColumnsFromNode(node: { name: string; type: string; properties?: Record<string, unknown> }): Array<{
    name: string;
    type: string;
    nullable: boolean;
  }> {
    const baseColumns = [
      { name: 'id', type: 'uuid', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: false },
      { name: 'updated_at', type: 'timestamp', nullable: false },
    ];

    const domainColumns: Array<{ name: string; type: string; nullable: boolean }> = [];

    switch (node.type) {
      case 'cache':
        domainColumns.push(
          { name: 'key', type: 'text', nullable: false },
          { name: 'value', type: 'jsonb', nullable: false },
          { name: 'expires_at', type: 'timestamp', nullable: true },
        );
        break;
      case 'queue':
      case 'event_store':
        domainColumns.push(
          { name: 'event_type', type: 'text', nullable: false },
          { name: 'payload', type: 'jsonb', nullable: false },
          { name: 'processed_at', type: 'timestamp', nullable: true },
        );
        break;
      case 'object_store':
        domainColumns.push(
          { name: 'bucket', type: 'text', nullable: false },
          { name: 'object_key', type: 'text', nullable: false },
          { name: 'size_bytes', type: 'integer', nullable: false },
          { name: 'content_type', type: 'text', nullable: true },
        );
        break;
      default:
        domainColumns.push(
          { name: 'name', type: 'text', nullable: false },
          { name: 'data', type: 'jsonb', nullable: true },
        );
    }

    return [...baseColumns, ...domainColumns];
  }

  private generateArchitectureOverview(
    nodes: Array<{ id: string; name: string; type: string; description?: string | null }>,
    edges: Array<{ source: string; target: string; type: string }>,
  ): string {
    const nodeTypeCounts = new Map<string, number>();
    for (const n of nodes) {
      nodeTypeCounts.set(n.type, (nodeTypeCounts.get(n.type) ?? 0) + 1);
    }

    const summary = Array.from(nodeTypeCounts.entries())
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    return `Architecture with ${nodes.length} nodes (${summary}) and ${edges.length} edges across ${new Set(edges.map((e) => e.type)).size} edge types.`;
  }

  // ── Helpers ─────────────────────────────────────────────────

  private createTask(
    type: TaskType,
    input: Record<string, unknown>,
    dependencies: string[] = [],
  ): OrchestrationTask {
    return {
      id: `task-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      status: dependencies.length === 0 ? 'ready' : 'pending',
      agentId: this.selectAgent(type)?.id ?? null,
      input,
      dependencies,
      priority: this.getPriority(type),
      retries: 0,
      maxRetries: this.maxRetries,
      createdAt: new Date().toISOString(),
    };
  }

  private getPriority(type: TaskType): number {
    const priorityMap: Record<TaskType, number> = {
      plan: 1,
      generate_database: 2,
      generate_backend: 3,
      generate_api: 4,
      generate_frontend: 5,
      generate_infra: 6,
      validate: 7,
      simulate: 8,
      deploy: 9,
      document: 10,
    };
    return priorityMap[type] ?? 5;
  }

  private getReadyTasks(): OrchestrationTask[] {
    const ready: OrchestrationTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.status !== 'ready' && task.status !== 'pending') continue;
      if (task.status === 'pending') {
        // Check if all dependencies are completed
        const allDepsComplete = task.dependencies.every((depId) => {
          const dep = this.tasks.get(depId);
          return dep?.status === 'completed';
        });
        if (allDepsComplete) {
          task.status = 'ready';
        } else {
          continue;
        }
      }
      ready.push(task);
    }
    return ready.sort((a, b) => a.priority - b.priority);
  }

  private getPendingTasks(): OrchestrationTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === 'pending' || t.status === 'ready',
    );
  }

  private hasRemainingTasks(): boolean {
    return (
      Array.from(this.tasks.values()).some(
        (t) => t.status === 'pending' || t.status === 'ready' || t.status === 'running',
      ) || this.runningTasks.size > 0
    );
  }

  private categorizeNodes(nodes: Array<{ id: string; name: string; type: string }>) {
    return {
      databases: nodes.filter((n) => ['database', 'cache', 'queue', 'event_store', 'object_store'].includes(n.type)),
      backendServices: nodes.filter((n) => ['service', 'function', 'container', 'pod'].includes(n.type)),
      apiNodes: nodes.filter((n) =>
        ['api_gateway', 'rest_endpoint', 'graphql_schema', 'grpc_service', 'webhook'].includes(n.type),
      ),
      frontendNodes: nodes.filter((n) => ['page', 'component', 'form', 'table', 'chart'].includes(n.type)),
      infraNodes: nodes.filter((n) => ['environment', 'region', 'cluster', 'namespace', 'load_balancer', 'dns'].includes(n.type)),
      agentNodes: nodes.filter((n) => ['agent', 'tool', 'prompt_template'].includes(n.type)),
      hasDocumentableNodes: (allNodes: Array<{ id: string; name: string; type: string }>) =>
        allNodes.length > 0,
    };
  }
}

function backendTasks(plan: OrchestrationTask[]): OrchestrationTask | undefined {
  return plan.find((t) => t.type === 'generate_backend');
}
