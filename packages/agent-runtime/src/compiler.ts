import type { AgentGraph, AgentGraphNode, AgentGraphEdge } from '@genesis-1/shared';

interface CompiledNode {
  id: string;
  type: AgentGraphNode['type'];
  label: string;
  config: Record<string, unknown>;
  edges: { target: string; condition?: Record<string, unknown> }[];
}

interface CompiledGraph {
  nodes: Map<string, CompiledNode>;
  entryNodeId: string | null;
  terminalNodeIds: Set<string>;
}

export class AgentGraphCompiler {
  compile(graph: AgentGraph): CompiledGraph {
    const nodeMap = new Map<string, CompiledNode>();
    const hasIncoming = new Set<string>();
    const hasOutgoing = new Set<string>();

    for (const node of graph.nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        type: node.type,
        label: node.label,
        config: node.config,
        edges: [],
      });
    }

    for (const edge of graph.edges) {
      const source = nodeMap.get(edge.source);
      if (source) {
        source.edges.push({ target: edge.target, condition: edge.condition });
      }
      hasIncoming.add(edge.target);
      hasOutgoing.add(edge.source);
    }

    // Find entry (nodes with no incoming edges) and terminal (nodes with no outgoing edges) nodes
    const entryNodeId = graph.nodes.find((n) => !hasIncoming.has(n.id))?.id ?? null;
    const terminalNodeIds = new Set(
      graph.nodes.filter((n) => !hasOutgoing.has(n.id)).map((n) => n.id),
    );

    return { nodes: nodeMap, entryNodeId, terminalNodeIds };
  }

  validate(graph: AgentGraph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (graph.nodes.length === 0) {
      errors.push('Graph must have at least one node');
    }

    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source)) errors.push(`Edge references unknown source node: ${edge.source}`);
      if (!nodeIds.has(edge.target)) errors.push(`Edge references unknown target node: ${edge.target}`);
    }

    const compiled = this.compile(graph);
    if (!compiled.entryNodeId) {
      errors.push('Graph has no entry node (a node without incoming edges is required)');
    }

    return { valid: errors.length === 0, errors };
  }
}
