import type { GraphNode, GraphEdge } from '@genesis-1/shared';
import type { TemplateMatch } from './engine';

interface ArchitectureTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web_app' | 'microservices' | 'event_driven' | 'data_pipeline' | 'serverless' | 'ai_pipeline';
  expectedNodes: Array<{ type: string; min: number; max?: number }>;
  expectedEdges: Array<{ type: string; between: [string, string] }>;
  suggestedAdditions: string[];
  tags: string[];
}

const BUILT_IN_TEMPLATES: ArchitectureTemplate[] = [
  {
    id: 'tpl-web-app',
    name: 'Standard Web Application',
    description: 'Monolithic or layered web app with database and optional cache',
    category: 'web_app',
    expectedNodes: [
      { type: 'service', min: 1, max: 3 },
      { type: 'database', min: 1, max: 2 },
      { type: 'api_gateway', min: 0, max: 1 },
      { type: 'page', min: 1 },
    ],
    expectedEdges: [
      { type: 'depends_on', between: ['service', 'database'] },
      { type: 'routes_to', between: ['api_gateway', 'service'] },
    ],
    suggestedAdditions: ['cache', 'load_balancer', 'cdn'],
    tags: ['web', 'monolith', 'starter'],
  },
  {
    id: 'tpl-microservices',
    name: 'Microservices Architecture',
    description: 'Distributed system with independent services, API gateway, and event bus',
    category: 'microservices',
    expectedNodes: [
      { type: 'service', min: 3 },
      { type: 'api_gateway', min: 1 },
      { type: 'event_topic', min: 1 },
      { type: 'database', min: 1 },
      { type: 'cache', min: 0 },
    ],
    expectedEdges: [
      { type: 'routes_to', between: ['api_gateway', 'service'] },
      { type: 'consumes_from', between: ['service', 'event_topic'] },
      { type: 'produces_to', between: ['service', 'event_topic'] },
    ],
    suggestedAdditions: ['queue', 'circuit_breaker', 'service_mesh'],
    tags: ['microservices', 'distributed', 'enterprise'],
  },
  {
    id: 'tpl-event-driven',
    name: 'Event-Driven Architecture',
    description: 'Async system with event sourcing, CQRS, and message brokers',
    category: 'event_driven',
    expectedNodes: [
      { type: 'event_topic', min: 2 },
      { type: 'event_store', min: 1 },
      { type: 'service', min: 2 },
      { type: 'queue', min: 1 },
    ],
    expectedEdges: [
      { type: 'emits', between: ['service', 'event_topic'] },
      { type: 'subscribes_to', between: ['service', 'event_topic'] },
      { type: 'consumes_from', between: ['service', 'queue'] },
    ],
    suggestedAdditions: ['event_store', 'dead_letter_queue', 'schema_registry'],
    tags: ['event-driven', 'cqrs', 'async'],
  },
  {
    id: 'tpl-serverless',
    name: 'Serverless Architecture',
    description: 'Function-based architecture with managed services',
    category: 'serverless',
    expectedNodes: [
      { type: 'function', min: 2 },
      { type: 'api_gateway', min: 1 },
      { type: 'database', min: 1 },
      { type: 'object_store', min: 0 },
    ],
    expectedEdges: [
      { type: 'triggers', between: ['api_gateway', 'function'] },
      { type: 'writes_to', between: ['function', 'database'] },
    ],
    suggestedAdditions: ['cdn', 'edge_function', 'message_queue'],
    tags: ['serverless', 'lambda', 'managed'],
  },
  {
    id: 'tpl-ai-pipeline',
    name: 'AI Agent Pipeline',
    description: 'AI orchestration with agents, tools, vector stores, and LLM connectors',
    category: 'ai_pipeline',
    expectedNodes: [
      { type: 'agent', min: 1 },
      { type: 'tool', min: 1 },
      { type: 'vector_store', min: 0, max: 2 },
      { type: 'service', min: 1 },
    ],
    expectedEdges: [
      { type: 'depends_on', between: ['agent', 'tool'] },
      { type: 'depends_on', between: ['agent', 'vector_store'] },
      { type: 'depends_on', between: ['agent', 'service'] },
    ],
    suggestedAdditions: ['embeddings_service', 'prompt_template', 'guardrails'],
    tags: ['ai', 'agents', 'llm', 'rag'],
  },
];

export class TemplateRegistry {
  private templates: ArchitectureTemplate[] = [...BUILT_IN_TEMPLATES];

  addTemplate(tpl: ArchitectureTemplate): void {
    this.templates.push(tpl);
  }

  listTemplates(): ArchitectureTemplate[] {
    return [...this.templates];
  }

  getTemplate(id: string): ArchitectureTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  async match(nodes: GraphNode[], edges: GraphEdge[]): Promise<TemplateMatch[]> {
    const matches: TemplateMatch[] = [];
    const nodeTypes = nodes.map((n) => n.type);
    const edgeTypes = edges.map((e) => e.type);

    for (const tpl of this.templates) {
      let score = 0;
      const matchedNodes: string[] = [];

      // Check node type coverage
      for (const expected of tpl.expectedNodes) {
        const count = nodeTypes.filter((t) => t === expected.type).length;
        if (count >= expected.min) {
          score += 1;
          matchedNodes.push(...nodes.filter((n) => n.type === expected.type).map((n) => n.id));
        }
      }

      // Check edge type coverage
      for (const expected of tpl.expectedEdges) {
        const matchingEdges = edges.filter(
          (e) =>
            e.type === expected.type &&
            nodes.find((n) => n.id === e.source)?.type === expected.between[0] &&
            nodes.find((n) => n.id === e.target)?.type === expected.between[1],
        );
        if (matchingEdges.length > 0) score += 0.5;
      }

      const normalizedScore = score / (tpl.expectedNodes.length + tpl.expectedEdges.length * 0.5);

      if (normalizedScore > 0.3) {
        matches.push({
          templateId: tpl.id,
          templateName: tpl.name,
          matchScore: Math.round(normalizedScore * 100),
          matchedNodes: [...new Set(matchedNodes)],
          suggestedAdditions: tpl.suggestedAdditions,
        });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }
}
