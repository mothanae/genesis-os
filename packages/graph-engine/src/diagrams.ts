import type { GraphNode, GraphEdge } from '@genesis-1/shared';

export type DiagramFormat = 'mermaid' | 'graphviz' | 'd2' | 'plantuml';

interface DiagramOptions {
  format: DiagramFormat;
  direction?: 'TB' | 'LR' | 'RL' | 'BT';
  title?: string;
  showPorts?: boolean;
  showRuntime?: boolean;
  highlightCycles?: boolean;
  groupByEnvironment?: boolean;
}

export class ArchitectureDiagrams {
  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    options: DiagramOptions,
  ): string {
    switch (options.format) {
      case 'mermaid': return this.generateMermaid(nodes, edges, options);
      case 'graphviz': return this.generateGraphviz(nodes, edges, options);
      case 'd2': return this.generateD2(nodes, edges, options);
      case 'plantuml': return this.generatePlantUML(nodes, edges, options);
      default: return this.generateMermaid(nodes, edges, options);
    }
  }

  private generateMermaid(
    nodes: GraphNode[],
    edges: GraphEdge[],
    options: DiagramOptions,
  ): string {
    const dir = options.direction ?? 'TB';
    let diagram = `graph ${dir}\n`;

    if (options.title) {
      diagram += `    %% ${options.title}\n`;
    }

    // Group by type for styling
    const typeGroups = new Map<string, GraphNode[]>();
    for (const node of nodes) {
      const group = typeGroups.get(node.type) ?? [];
      group.push(node);
      typeGroups.set(node.type, group);
    }

    // Subgraph for environments if enabled
    if (options.groupByEnvironment) {
      const environments = nodes.filter((n) => n.type === 'environment');
      for (const env of environments) {
        diagram += `    subgraph ${this.safeId(env.name)}["${env.name}"]\n`;
        const children = nodes.filter((n) =>
          edges.some((e) => e.source === env.id && e.target === n.id && e.type === 'contains'),
        );
        for (const child of children) {
          diagram += `        ${this.safeId(child.id)}[${this.escapeLabel(child.name)}]\n`;
        }
        diagram += `    end\n`;
      }
    } else {
      // Style definitions
      diagram += `    %% Node style classes\n`;
      diagram += `    classDef service fill:#3b82f6,stroke:#1d4ed8,color:#fff\n`;
      diagram += `    classDef database fill:#22c55e,stroke:#15803d,color:#fff\n`;
      diagram += `    classDef cache fill:#f97316,stroke:#c2410c,color:#fff\n`;
      diagram += `    classDef queue fill:#eab308,stroke:#a16207,color:#fff\n`;
      diagram += `    classDef gateway fill:#6366f1,stroke:#4338ca,color:#fff\n`;
      diagram += `    classDef topic fill:#ec4899,stroke:#be185d,color:#fff\n`;
      diagram += `    classDef agent fill:#8b5cf6,stroke:#6d28d9,color:#fff\n`;
      diagram += `    classDef ui fill:#06b6d4,stroke:#0891b2,color:#fff\n`;
      diagram += `    classDef infra fill:#6b7280,stroke:#374151,color:#fff\n`;
      diagram += `    classDef default fill:#9ca3af,stroke:#4b5563,color:#fff\n`;
      diagram += `\n`;

      // Nodes with appropriate shapes
      for (const node of nodes) {
        const id = this.safeId(node.id);
        const label = this.escapeLabel(node.name);
        const shape = this.nodeShape(node.type);
        const extra = this.nodeExtra(node, options);

        diagram += `    ${id}${shape}"${label}${extra}"\n`;

        // Style assignment
        const cls = this.mermaidClass(node.type);
        if (cls) diagram += `    class ${id} ${cls}\n`;
      }
      diagram += `\n`;
    }

    // Edges
    for (const edge of edges) {
      const src = this.safeId(edge.source);
      const tgt = this.safeId(edge.target);
      const arrow = this.edgeArrow(edge.type);
      const label = edge.label ? `|${this.escapeLabel(edge.label)}|` : '';
      const style = edge.realtime ? ' style=animated' : '';

      diagram += `    ${src} ${arrow}${label} ${tgt}${style}\n`;
    }

    return diagram;
  }

  private nodeShape(type: string): string {
    const shapes: Record<string, string> = {
      database: '[(',
      cache: '[((',
      queue: '>',
      event_topic: '{{',
      api_gateway: '[/',
      function: '{{',
      agent: '((',
      decision: '{',
      environment: '[',
    };
    return shapes[type] ?? '[';
  }

  private nodeExtra(node: GraphNode, options: DiagramOptions): string {
    const parts: string[] = [];
    if (options.showRuntime && node.runtime) {
      const rt = node.runtime as Record<string, unknown>;
      if (rt.replicas) parts.push(`replicas:${rt.replicas}`);
      if (rt.memory) parts.push(`${rt.memory}`);
    }
    if (node.description) {
      parts.push(node.description.slice(0, 30));
    }
    return parts.length > 0 ? `\\n[${parts.join(', ')}]` : '';
  }

  private mermaidClass(type: string): string {
    const classMap: Record<string, string> = {
      service: 'service', function: 'service', container: 'service', pod: 'service',
      database: 'database', event_store: 'database', object_store: 'database',
      cache: 'cache',
      queue: 'queue',
      api_gateway: 'gateway', load_balancer: 'gateway', proxy: 'gateway',
      event_topic: 'topic', event_subscription: 'topic',
      agent: 'agent', tool: 'agent',
      page: 'ui', component: 'ui', form: 'ui', table: 'ui', chart: 'ui',
      environment: 'infra', region: 'infra', cluster: 'infra', namespace: 'infra',
    };
    return classMap[type] ?? '';
  }

  private edgeArrow(type: string): string {
    const arrows: Record<string, string> = {
      depends_on: '-->',
      communicates_with: '---',
      contains: '--o',
      implements: '..|>',
      deployed_to: '-.->',
      triggers: '==>',
      routes_to: '-->',
      consumes_from: '-->>',
      produces_to: '-->>',
      flows_to: '==>',
      subscribes_to: '-->>',
      emits: '==>',
    };
    return arrows[type] ?? '-->';
  }

  private safeId(id: string): string {
    return `n${id.replace(/-/g, '')}`;
  }

  private escapeLabel(label: string): string {
    return label.replace(/"/g, "'").replace(/\n/g, ' ');
  }

  // ── Other Formats ─────────────────────────────────────────

  private generateGraphviz(nodes: GraphNode[], edges: GraphEdge[], options: DiagramOptions): string {
    let dot = `digraph G {\n  rankdir=${options.direction ?? 'TB'};\n  node [shape=box];\n\n`;
    for (const n of nodes) {
      dot += `  "${this.escapeLabel(n.name)}" [label="${this.escapeLabel(n.name)}", shape=${this.gvShape(n.type)}];\n`;
    }
    for (const e of edges) {
      const src = nodes.find((n) => n.id === e.source)?.name ?? e.source;
      const tgt = nodes.find((n) => n.id === e.target)?.name ?? e.target;
      dot += `  "${this.escapeLabel(src)}" -> "${this.escapeLabel(tgt)}" [label="${e.type}"];\n`;
    }
    dot += `}\n`;
    return dot;
  }

  private generateD2(nodes: GraphNode[], edges: GraphEdge[], options: DiagramOptions): string {
    let d2 = `# Architecture Diagram — ${options.title ?? 'Untitled'}\ndirection: ${options.direction?.toLowerCase() === 'lr' ? 'right' : 'down'}\n\n`;
    for (const n of nodes) {
      d2 += `${this.d2SafeId(n.name)}: "${this.escapeLabel(n.name)}" { shape: ${this.d2Shape(n.type)} }\n`;
    }
    for (const e of edges) {
      const src = this.d2SafeId(nodes.find((n) => n.id === e.source)?.name ?? e.source);
      const tgt = this.d2SafeId(nodes.find((n) => n.id === e.target)?.name ?? e.target);
      d2 += `${src} -> ${tgt}: "${e.type}"\n`;
    }
    return d2;
  }

  private generatePlantUML(nodes: GraphNode[], edges: GraphEdge[], options: DiagramOptions): string {
    let puml = `@startuml\n!theme plain\n\n`;
    for (const n of nodes) {
      const pType = this.puType(n.type);
      puml += `${pType} "${this.escapeLabel(n.name)}" as ${this.safeId(n.id)}\n`;
    }
    for (const e of edges) {
      puml += `${this.safeId(e.source)} --> ${this.safeId(e.target)} : ${e.type}\n`;
    }
    puml += `@enduml\n`;
    return puml;
  }

  private gvShape(type: string): string {
    return type === 'database' ? 'cylinder' : type === 'queue' ? 'cds' : type === 'cache' ? 'hexagon' : 'box';
  }

  private d2SafeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private d2Shape(type: string): string {
    return type === 'database' ? 'cylinder' : type === 'queue' ? 'queue' : 'rectangle';
  }

  private puType(type: string): string {
    switch (type) {
      case 'database': return 'database';
      case 'queue': return 'queue';
      case 'agent': return 'agent';
      case 'api_gateway': return 'interface';
      case 'service': return 'component';
      case 'cache': return 'storage';
      default: return 'component';
    }
  }
}
