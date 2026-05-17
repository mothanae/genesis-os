import type { GraphEngine } from '@genesis-1/graph-engine';
import type { GraphNode, GraphEdge } from '@genesis-1/shared';
import type { SelfHealAction } from './engine';

export class SelfHealer {
  constructor(private readonly graphEngine: GraphEngine) {}

  async heal(nodes: GraphNode[], edges: GraphEdge[], projectId: string): Promise<SelfHealAction[]> {
    const actions: SelfHealAction[] = [];

    // 1. Fix orphaned nodes — connect to nearest context
    const connectedIds = new Set<string>();
    for (const edge of edges) {
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    }

    for (const node of nodes) {
      if (!connectedIds.has(node.id) && nodes.length > 1) {
        const action: SelfHealAction = {
          id: `fix-orphan-${node.id}`,
          type: 'remove_orphan',
          description: `Orphaned node "${node.name}" has no connections`,
          nodeId: node.id,
          applied: false,
          success: false,
        };

        // Find the best parent context (environment or bounded_context)
        const parentContext = nodes.find(
          (n) => ['environment', 'bounded_context', 'module'].includes(n.type) && n.id !== node.id,
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
        }

        actions.push(action);
      }
    }

    // 2. Fix missing health checks for services
    for (const node of nodes) {
      if (['service', 'function', 'api_gateway', 'container'].includes(node.type)) {
        const rt = node.runtime as Record<string, unknown> | null;
        if (!rt || !rt.healthCheck) {
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
              runtime: { ...(rt ?? {}), healthCheck: { path: '/health', port: 3000, intervalSeconds: 30, timeoutSeconds: 5 } },
            });
            action.applied = true;
            action.success = true;
          } catch {
            // Non-fatal
          }

          actions.push(action);
        }
      }
    }

    // 3. Fix missing output ports for services
    for (const node of nodes) {
      if (['service', 'api_gateway'].includes(node.type) && node.outputs.length === 0) {
        actions.push({
          id: `fix-ports-${node.id}`,
          type: 'fix_port',
          description: `Added default HTTP output port to "${node.name}"`,
          nodeId: node.id,
          applied: true,
          success: true,
        });

        await this.graphEngine.updateNode(node.id, {
          outputs: [
            { id: `port-http-${node.id}`, name: 'HTTP', type: 'data', direction: 'output', schema: { protocol: 'http' } },
          ],
        });
      }
    }

    return actions;
  }
}
