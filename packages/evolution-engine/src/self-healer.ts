import type { GraphEngine } from '@genesis-1/graph-engine';
import type { GraphNode, GraphEdge } from '@genesis-1/shared';
import type { SelfHealAction } from './engine';

export class SelfHealer {
  constructor(private readonly graphEngine: GraphEngine) {}

  async heal(nodes: GraphNode[], edges: GraphEdge[], projectId: string): Promise<SelfHealAction[]> {
    const actions: SelfHealAction[] = [];

    const connectedIds = new Set<string>();
    for (const edge of edges) {
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    }

    // 1. Fix orphaned nodes — connect to nearest context
    for (const node of nodes) {
      if (!connectedIds.has(node.id) && nodes.length > 1) {
        const action = await this.healOrphan(node, nodes, edges, projectId);
        if (action) actions.push(action);
      }
    }

    // 2. Fix missing health checks for services
    for (const node of nodes) {
      if (['service', 'function', 'api_gateway', 'container'].includes(node.type)) {
        const action = await this.healHealthCheck(node, projectId);
        if (action) actions.push(action);
      }
    }

    // 3. Fix missing output ports for services
    for (const node of nodes) {
      if (['service', 'api_gateway'].includes(node.type) && node.outputs.length === 0) {
        const action = await this.healOutputPorts(node, projectId);
        if (action) actions.push(action);
      }
    }

    // 4. Fix missing auth — suggest auth service when API gateway has no auth
    const apiGateway = nodes.find((n) => n.type === 'api_gateway');
    const hasAuth = nodes.some((n) => n.name.toLowerCase().includes('auth') || n.type === 'rest_endpoint' && n.name.toLowerCase().includes('auth'));
    if (apiGateway && !hasAuth) {
      actions.push({
        id: `fix-auth-${projectId}`,
        type: 'add_auth',
        description: 'API Gateway detected but no auth service — requests may be unauthenticated',
        nodeId: apiGateway.id,
        applied: false,
        success: false,
      });
    }

    // 5. Services directly communicating suggest event bus decoupling
    const serviceNodes = nodes.filter((n) => n.type === 'service');
    const directCommEdges = edges.filter(
      (e) => e.type === 'communicates_with' || e.type === 'depends_on',
    );
    const hasEventBus = nodes.some((n) => n.type === 'event_topic' || n.type === 'queue');
    if (serviceNodes.length > 3 && directCommEdges.length > 5 && !hasEventBus) {
      actions.push({
        id: `fix-event-bus-${projectId}`,
        type: 'add_event_bus',
        description: `${serviceNodes.length} services with ${directCommEdges.length} direct communication edges — introduce an event bus for loose coupling`,
        nodeId: serviceNodes[0]?.id,
        applied: false,
        success: false,
      });
    }

    // 6. Database with high fan-in — suggest connection pooling or data service
    const dbNodes = nodes.filter((n) => n.type === 'database');
    for (const db of dbNodes) {
      const incomingEdges = edges.filter((e) => e.target === db.id);
      if (incomingEdges.length > 5) {
        actions.push({
          id: `fix-db-fan-in-${db.id}`,
          type: 'recommend_data_service',
          description: `Database "${db.name}" has ${incomingEdges.length} incoming connections — add a data service layer`,
          nodeId: db.id,
          applied: false,
          success: false,
        });
      }
    }

    // 7. Services without rate limiting
    if (apiGateway) {
      const hasRateLimiter = nodes.some(
        (n) => n.type === 'cache' && n.name.toLowerCase().includes('rate'),
      );
      if (!hasRateLimiter) {
        actions.push({
          id: `fix-rate-limit-${projectId}`,
          type: 'add_rate_limiter',
          description: 'API Gateway without rate limiting — add a rate limit cache to prevent abuse',
          nodeId: apiGateway.id,
          applied: false,
          success: false,
        });
      }
    }

    return actions;
  }

  // ── Individual Healers ──────────────────────────────────────────

  private async healOrphan(
    node: GraphNode,
    nodes: GraphNode[],
    edges: GraphEdge[],
    projectId: string,
  ): Promise<SelfHealAction | null> {
    const action: SelfHealAction = {
      id: `fix-orphan-${node.id}`,
      type: 'remove_orphan',
      description: `Orphaned node "${node.name}" has no connections`,
      nodeId: node.id,
      applied: false,
      success: false,
    };

    // Find the best parent context
    const parentContext = nodes.find(
      (n) => ['environment', 'bounded_context', 'module', 'cluster', 'namespace'].includes(n.type) && n.id !== node.id,
    );

    if (parentContext) {
      try {
        await this.graphEngine.createEdge(projectId, {
          source: parentContext.id,
          target: node.id,
          type: 'contains',
          label: `${parentContext.name} contains ${node.name}`,
        });
        action.applied = true;
        action.success = true;
        action.description = `Connected orphan "${node.name}" to "${parentContext.name}" via "contains" edge`;
      } catch {
        action.description = `Failed to connect orphan "${node.name}"`;
      }
    } else {
      // No parent context found — check if any service can adopt it
      const nearestService = nodes.find(
        (n) => ['service', 'function', 'container'].includes(n.type) && n.id !== node.id,
      );
      if (nearestService) {
        try {
          await this.graphEngine.createEdge(projectId, {
            source: nearestService.id,
            target: node.id,
            type: 'depends_on',
            label: `${nearestService.name} depends on ${node.name}`,
          });
          action.applied = true;
          action.success = true;
          action.description = `Connected orphan "${node.name}" to "${nearestService.name}" via "depends_on" edge`;
        } catch {
          action.description = `Failed to connect orphan "${node.name}"`;
        }
      }
    }

    return action;
  }

  private async healHealthCheck(node: GraphNode, _projectId: string): Promise<SelfHealAction | null> {
    const rt = node.runtime as Record<string, unknown> | null;
    if (rt?.healthCheck) return null;

    const action: SelfHealAction = {
      id: `fix-healthcheck-${node.id}`,
      type: 'add_runtime_config',
      description: `Add health check config for "${node.name}"`,
      nodeId: node.id,
      applied: false,
      success: false,
    };

    try {
      await this.graphEngine.updateNode(node.id, {
        runtime: {
          ...(rt ?? {}),
          healthCheck: {
            path: '/health',
            port: 3000,
            intervalSeconds: 30,
            timeoutSeconds: 5,
          },
        },
      });
      action.applied = true;
      action.success = true;
    } catch {
      // Non-fatal
    }

    return action;
  }

  private async healOutputPorts(node: GraphNode, _projectId: string): Promise<SelfHealAction | null> {
    const action: SelfHealAction = {
      id: `fix-ports-${node.id}`,
      type: 'fix_port',
      description: `Added default HTTP output port to "${node.name}"`,
      nodeId: node.id,
      applied: true,
      success: true,
    };

    try {
      await this.graphEngine.updateNode(node.id, {
        outputs: [
          {
            id: `port-http-${node.id}`,
            name: 'HTTP',
            type: 'data',
            direction: 'output',
            schema: { protocol: 'http' },
          },
        ],
      });
    } catch {
      action.applied = false;
      action.success = false;
    }

    return action;
  }
}
