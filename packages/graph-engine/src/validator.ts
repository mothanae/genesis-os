import type {
  GraphNode,
  GraphEdge,
  CycleResult,
  TopologyValidation,
  GraphValidationError,
  GraphValidationWarning,
  GraphSuggestion,
} from '@genesis-1/shared';

export class GraphValidator {
  validate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    cycles: CycleResult[],
  ): TopologyValidation {
    const errors: GraphValidationError[] = [];
    const warnings: GraphValidationWarning[] = [];
    const suggestions: GraphSuggestion[] = [];

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const nodeIds = new Set(nodes.map((n) => n.id));

    // 1. Cycle detection (ERROR)
    for (const cycle of cycles) {
      errors.push({
        code: 'GRAPH_CYCLE',
        message: `Dependency cycle detected: ${cycle.nodeIds.join(' → ')}`,
        nodeId: cycle.nodeIds[0],
        severity: 'error',
      });
      suggestions.push({
        code: 'GRAPH_CYCLE_FIX',
        message: 'Remove one edge in the cycle to break the circular dependency',
        suggestion: 'Identify the least critical dependency in the cycle and remove or redirect it',
        nodeId: cycle.nodeIds[0],
      });
    }

    // 2. Orphaned nodes — nodes with no edges (WARNING)
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    for (const node of nodes) {
      if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
        warnings.push({
          code: 'ORPHANED_NODE',
          message: `Node "${node.name}" (${node.id}) has no connections`,
          nodeId: node.id,
          severity: 'warning',
        });
        suggestions.push({
          code: 'ORPHANED_NODE_FIX',
          message: `Connect "${node.name}" to other components or remove it`,
          suggestion: `Add edges to define how "${node.name}" relates to the rest of the architecture`,
          nodeId: node.id,
        });
      }
    }

    // 3. Missing source/target references (ERROR)
    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          code: 'MISSING_SOURCE',
          message: `Edge ${edge.id} references nonexistent source node: ${edge.source}`,
          edgeId: edge.id,
          severity: 'error',
        });
      }
      if (!nodeIds.has(edge.target)) {
        errors.push({
          code: 'MISSING_TARGET',
          message: `Edge ${edge.id} references nonexistent target node: ${edge.target}`,
          edgeId: edge.id,
          severity: 'error',
        });
      }
    }

    // 4. Validate node types can connect (WARNING)
    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (sourceNode && targetNode) {
        const valid = this.validateConnection(sourceNode.type, targetNode.type, edge.type);
        if (!valid) {
          warnings.push({
            code: 'INVALID_CONNECTION',
            message: `"${edge.type}" edge from "${sourceNode.type}" to "${targetNode.type}" may be invalid`,
            edgeId: edge.id,
            severity: 'warning',
          });
        }
      }
    }

    // 5. Database nodes must have at least one consumer (WARNING)
    for (const node of nodes) {
      if (node.type === 'database') {
        const hasReader = edges.some(
          (e) => e.target === node.id && ['reads_from', 'writes_to', 'depends_on', 'consumes_from'].includes(e.type),
        );
        if (!hasReader) {
          warnings.push({
            code: 'UNUSED_DATABASE',
            message: `Database "${node.name}" has no consuming services`,
            nodeId: node.id,
            severity: 'warning',
          });
        }
      }
    }

    // 6. Services should expose at least one output port (WARNING)
    for (const node of nodes) {
      if (['service', 'function', 'api_gateway'].includes(node.type) && node.outputs.length === 0) {
        warnings.push({
          code: 'NO_OUTPUT_PORTS',
          message: `"${node.type}" "${node.name}" has no output ports defined`,
          nodeId: node.id,
          severity: 'warning',
        });
        suggestions.push({
          code: 'ADD_OUTPUT_PORTS',
          message: `Define output ports for "${node.name}"`,
          suggestion: 'Add ports describing what this component exposes (APIs, events, data)',
          nodeId: node.id,
        });
      }
    }

    // 7. High fan-out check (> 10 direct dependencies from one node) (WARNING)
    for (const node of nodes) {
      const outDegree = edges.filter((e) => e.source === node.id).length;
      if (outDegree > 10) {
        warnings.push({
          code: 'HIGH_FAN_OUT',
          message: `Node "${node.name}" has ${outDegree} outgoing connections — consider an intermediary`,
          nodeId: node.id,
          severity: 'warning',
        });
        suggestions.push({
          code: 'HIGH_FAN_OUT_FIX',
          message: `Introduce an API gateway, queue, or facade to reduce direct coupling`,
          suggestion: 'Add an intermediary node (api_gateway, queue, or event_topic) to decouple consumers',
          nodeId: node.id,
        });
      }
    }

    // 8. Missing runtime config for service nodes (INFO/SUGGESTION)
    for (const node of nodes) {
      if (['service', 'function', 'container', 'api_gateway'].includes(node.type) && !node.runtime) {
        suggestions.push({
          code: 'MISSING_RUNTIME_CONFIG',
          message: `"${node.name}" has no runtime configuration`,
          suggestion: 'Configure replicas, memory, CPU, scaling, and health checks for production readiness',
          nodeId: node.id,
        });
      }
    }

    // 9. Self-referencing edges (ERROR)
    for (const edge of edges) {
      if (edge.source === edge.target) {
        errors.push({
          code: 'SELF_REFERENCE',
          message: `Edge ${edge.id} connects a node to itself`,
          edgeId: edge.id,
          severity: 'error',
        });
      }
    }

    // 10. Duplicate edges (WARNING)
    const edgeKeys = new Set<string>();
    for (const edge of edges) {
      const key = `${edge.source}:${edge.target}:${edge.type}`;
      if (edgeKeys.has(key)) {
        warnings.push({
          code: 'DUPLICATE_EDGE',
          message: `Duplicate edge of type "${edge.type}" between ${edge.source} and ${edge.target}`,
          edgeId: edge.id,
          severity: 'warning',
        });
      }
      edgeKeys.add(key);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate if a connection between two node types is architecturally sound.
   */
  private validateConnection(
    sourceType: string,
    targetType: string,
    edgeType: string,
  ): boolean {
    // Allow-list for known valid patterns
    const validPatterns = new Set([
      // Service -> Database
      'service:writes_to:database',
      'service:reads_from:database',
      'service:depends_on:database',
      'function:writes_to:database',
      'function:reads_from:database',
      'container:writes_to:database',
      'container:reads_from:database',
      // Service -> Cache
      'service:reads_from:cache',
      'service:writes_to:cache',
      'service:depends_on:cache',
      // Service -> Queue
      'service:produces_to:queue',
      'service:consumes_from:queue',
      'function:produces_to:queue',
      'function:consumes_from:queue',
      // Service -> Service
      'service:communicates_with:service',
      'service:depends_on:service',
      'service:routes_to:service',
      'function:triggers:function',
      'function:depends_on:function',
      // API Gateway
      'api_gateway:routes_to:service',
      'api_gateway:routes_to:function',
      'api_gateway:proxies_to:service',
      'load_balancer:routes_to:service',
      // Events
      'service:emits:event_topic',
      'service:subscribes_to:event_topic',
      'function:triggers:event_topic',
      'function:subscribes_to:event_topic',
      'service:triggers:webhook',
      // Deployment
      'service:deployed_to:environment',
      'function:deployed_to:environment',
      'container:deployed_to:cluster',
      'container:deployed_to:pod',
      'service:deployed_to:cluster',
      // Module / Logical
      'module:contains:module',
      'module:depends_on:module',
      'bounded_context:contains:aggregate_root',
      'bounded_context:depends_on:bounded_context',
      'aggregate_root:emits:domain_event',
      // Infrastructure
      'environment:contains:service',
      'environment:contains:database',
      'environment:contains:queue',
      'environment:contains:cache',
      'cluster:contains:namespace',
      'namespace:contains:pod',
      'region:contains:cluster',
      // AI
      'agent:depends_on:tool',
      'agent:reads_from:vector_store',
      'tool:depends_on:service',
      'tool:reads_from:database',
    ]);

    return validPatterns.has(`${sourceType}:${edgeType}:${targetType}`);
  }
}
