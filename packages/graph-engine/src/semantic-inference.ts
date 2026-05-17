import type { GraphNode, GraphEdge } from '@genesis-1/shared';

export interface InferredSubsystem {
  /** What should be added */
  system: string;
  /** Why it's inferred */
  reason: string;
  /** Node types to add */
  suggestedNodes: Array<{ type: string; name: string; description: string }>;
  /** Edges to add between existing and new nodes */
  suggestedEdges: Array<{ source: string; target: string; type: string; label: string }>;
  /** Confidence 0-1 */
  confidence: number;
}

// Semantic patterns: when source_type → target_type via edge_type, infer subsystems
const SEMANTIC_PATTERNS: Array<{
  sourceTypes: string[];
  targetTypes: string[];
  edgeTypes: string[];
  inferences: InferredSubsystem[];
}> = [
  // ── User → User ──────────────────────────────────────────────────
  {
    sourceTypes: ['service', 'function'],
    targetTypes: ['service', 'function'],
    edgeTypes: ['communicates_with', 'depends_on'],
    inferences: [
      {
        system: 'Messaging System',
        reason: 'Services that communicate typically need a messaging infrastructure',
        suggestedNodes: [
          { type: 'queue', name: 'Message Queue', description: 'Async message delivery between services' },
          { type: 'event_topic', name: 'Service Events', description: 'Event-driven communication channel' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__QUEUE__', type: 'produces_to', label: 'enqueues' },
          { source: '__QUEUE__', target: '__TARGET__', type: 'consumes_from', label: 'delivers to' },
        ],
        confidence: 0.7,
      },
      {
        system: 'Presence Service',
        reason: 'Inter-service communication often requires presence awareness',
        suggestedNodes: [
          { type: 'cache', name: 'Presence Cache', description: 'Real-time user/service presence tracking' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__CACHE__', type: 'writes_to', label: 'reports presence' },
        ],
        confidence: 0.5,
      },
      {
        system: 'Notification System',
        reason: 'Communication between services implies notification needs',
        suggestedNodes: [
          { type: 'event_topic', name: 'Notifications', description: 'Push/email/in-app notification events' },
          { type: 'function', name: 'Notification Dispatcher', description: 'Routes notifications to channels' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__NOTIFICATIONS__', type: 'emits', label: 'triggers notification' },
          { source: '__NOTIFICATIONS__', target: '__DISPATCHER__', type: 'routes_to', label: 'dispatches' },
        ],
        confidence: 0.6,
      },
    ],
  },
  // ── Service → Database ───────────────────────────────────────────
  {
    sourceTypes: ['service', 'function', 'container'],
    targetTypes: ['database'],
    edgeTypes: ['writes_to', 'reads_from', 'depends_on'],
    inferences: [
      {
        system: 'Data Access Layer',
        reason: 'Direct database access should go through a data service or repository layer',
        suggestedNodes: [
          { type: 'service', name: 'Data Service', description: 'Centralized data access with caching and connection pooling' },
          { type: 'cache', name: 'Query Cache', description: 'Cache frequent database queries' },
        ],
        suggestedEdges: [
          { source: '__DATA_SVC__', target: '__TARGET__', type: 'reads_from', label: 'queries' },
          { source: '__DATA_SVC__', target: '__CACHE__', type: 'writes_to', label: 'caches results' },
          { source: '__SOURCE__', target: '__DATA_SVC__', type: 'depends_on', label: 'uses' },
        ],
        confidence: 0.8,
      },
      {
        system: 'Database Replica',
        reason: 'Read-heavy services benefit from read replicas for scaling',
        suggestedNodes: [
          { type: 'database', name: 'Read Replica', description: 'Read-only replica for scaling query throughput' },
        ],
        suggestedEdges: [
          { source: '__TARGET__', target: '__REPLICA__', type: 'replicates_to', label: 'streams to' },
        ],
        confidence: 0.6,
      },
    ],
  },
  // ── Service → Queue ──────────────────────────────────────────────
  {
    sourceTypes: ['service', 'function'],
    targetTypes: ['queue'],
    edgeTypes: ['produces_to', 'consumes_from'],
    inferences: [
      {
        system: 'Worker Pool',
        reason: 'Queue processing needs worker services to consume messages',
        suggestedNodes: [
          { type: 'service', name: 'Queue Worker', description: 'Processes messages from the queue' },
        ],
        suggestedEdges: [
          { source: '__WORKER__', target: '__TARGET__', type: 'consumes_from', label: 'processes' },
        ],
        confidence: 0.85,
      },
      {
        system: 'Dead Letter Queue',
        reason: 'Production queues need dead letter handling for failed messages',
        suggestedNodes: [
          { type: 'queue', name: 'Dead Letter Queue', description: 'Stores messages that failed processing' },
        ],
        suggestedEdges: [
          { source: '__TARGET__', target: '__DLQ__', type: 'routes_to', label: 'failed messages' },
        ],
        confidence: 0.75,
      },
    ],
  },
  // ── API Gateway → Service ────────────────────────────────────────
  {
    sourceTypes: ['api_gateway', 'load_balancer'],
    targetTypes: ['service', 'function'],
    edgeTypes: ['routes_to', 'proxies_to'],
    inferences: [
      {
        system: 'Rate Limiter',
        reason: 'API gateways should enforce rate limiting to protect backend services',
        suggestedNodes: [
          { type: 'cache', name: 'Rate Limit Store', description: 'Stores rate limit counters per client' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__RATE_LIMIT__', type: 'reads_from', label: 'checks limit' },
        ],
        confidence: 0.9,
      },
      {
        system: 'Auth Service',
        reason: 'API gateways typically need authentication to validate requests',
        suggestedNodes: [
          { type: 'service', name: 'Auth Service', description: 'Handles authentication and authorization' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__AUTH__', type: 'routes_to', label: 'validates tokens' },
        ],
        confidence: 0.85,
      },
    ],
  },
  // ── Service → Service (microservices pattern) ────────────────────
  {
    sourceTypes: ['service'],
    targetTypes: ['service'],
    edgeTypes: ['depends_on', 'communicates_with', 'routes_to'],
    inferences: [
      {
        system: 'Service Mesh',
        reason: 'Multiple communicating services benefit from a service mesh for observability and traffic control',
        suggestedNodes: [
          { type: 'proxy', name: 'Sidecar Proxy', description: 'Envoy/Linkerd sidecar for mTLS and traffic management' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__PROXY__', type: 'depends_on', label: 'routes through' },
          { source: '__PROXY__', target: '__TARGET__', type: 'proxies_to', label: 'forwards to' },
        ],
        confidence: 0.7,
      },
      {
        system: 'Distributed Tracing',
        reason: 'Service-to-service calls need distributed tracing for debugging',
        suggestedNodes: [
          { type: 'event_store', name: 'Trace Store', description: 'Stores distributed trace spans' },
        ],
        suggestedEdges: [
          { source: '__TRACE__', target: '__TARGET__', type: 'collects_from', label: 'traces' },
        ],
        confidence: 0.65,
      },
    ],
  },
  // ── Events / Event Topics ────────────────────────────────────────
  {
    sourceTypes: ['service', 'function'],
    targetTypes: ['event_topic'],
    edgeTypes: ['emits', 'subscribes_to', 'triggers'],
    inferences: [
      {
        system: 'Event Bus',
        reason: 'Event-driven patterns need a reliable event bus for delivery guarantees',
        suggestedNodes: [
          { type: 'queue', name: 'Event Bus', description: 'Reliable event delivery with retry and DLQ support' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__EVENT_BUS__', type: 'produces_to', label: 'publishes events' },
          { source: '__EVENT_BUS__', target: '__TARGET__', type: 'routes_to', label: 'delivers events' },
        ],
        confidence: 0.8,
      },
      {
        system: 'Schema Registry',
        reason: 'Event-driven systems need schema versioning for compatibility',
        suggestedNodes: [
          { type: 'rest_endpoint', name: 'Schema Registry', description: 'Manages event schema versions and compatibility' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__SCHEMA_REGISTRY__', type: 'depends_on', label: 'registers schemas' },
        ],
        confidence: 0.6,
      },
    ],
  },
  // ── Service → Cache ──────────────────────────────────────────────
  {
    sourceTypes: ['service', 'function'],
    targetTypes: ['cache'],
    edgeTypes: ['writes_to', 'reads_from', 'depends_on'],
    inferences: [
      {
        system: 'Cache Invalidation',
        reason: 'Cached data needs invalidation strategy to prevent stale reads',
        suggestedNodes: [
          { type: 'event_topic', name: 'Cache Invalidation Events', description: 'Events that trigger cache invalidation' },
        ],
        suggestedEdges: [
          { source: '__SOURCE__', target: '__INVAL__', type: 'emits', label: 'publishes invalidation' },
        ],
        confidence: 0.7,
      },
    ],
  },
  // ── Service → Firebase/CDN (public content) ──────────────────────
  {
    sourceTypes: ['service', 'function', 'page', 'component'],
    targetTypes: ['cdn'],
    edgeTypes: ['depends_on', 'routes_to'],
    inferences: [
      {
        system: 'Static Asset Pipeline',
        reason: 'CDN usage implies a static asset build and deploy pipeline',
        suggestedNodes: [
          { type: 'object_store', name: 'Asset Storage', description: 'Origin storage for static assets' },
          { type: 'function', name: 'Asset Compiler', description: 'Compiles and optimizes static assets for CDN deployment' },
        ],
        suggestedEdges: [
          { source: '__COMPILER__', target: '__ASSETS__', type: 'writes_to', label: 'uploads assets' },
          { source: '__TARGET__', target: '__ASSETS__', type: 'reads_from', label: 'pulls from origin' },
        ],
        confidence: 0.7,
      },
    ],
  },
  // ── Multiple services → no gateway ───────────────────────────────
  {
    sourceTypes: ['service'],
    targetTypes: ['service'],
    edgeTypes: ['communicates_with', 'depends_on'],
    inferences: [
      {
        system: 'API Gateway',
        reason: 'Multiple services communicating directly should route through an API gateway',
        suggestedNodes: [
          { type: 'api_gateway', name: 'API Gateway', description: 'Centralized entry point for routing, auth, and rate limiting' },
        ],
        suggestedEdges: [
          { source: '__GATEWAY__', target: '__SOURCE__', type: 'routes_to', label: 'routes requests' },
          { source: '__GATEWAY__', target: '__TARGET__', type: 'routes_to', label: 'routes requests' },
        ],
        confidence: 0.75,
      },
    ],
  },
];

export class SemanticInference {
  /**
   * Analyze node and edge topology to infer implied subsystems.
   * Returns a deduplicated list of inference recommendations.
   */
  infer(nodes: GraphNode[], edges: GraphEdge[]): InferredSubsystem[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const results: InferredSubsystem[] = [];
    const seen = new Set<string>();

    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      for (const pattern of SEMANTIC_PATTERNS) {
        if (
          pattern.sourceTypes.includes(source.type) &&
          pattern.targetTypes.includes(target.type) &&
          pattern.edgeTypes.includes(edge.type)
        ) {
          for (const inference of pattern.inferences) {
            const key = `${inference.system}:${edge.source}:${edge.target}`;
            if (seen.has(key)) continue;
            seen.add(key);

            // Check if nodes of the suggested types already exist
            const existingTypes = new Set(nodes.map((n) => n.type));
            const existingNames = new Set(nodes.map((n) => n.name.toLowerCase()));

            // Filter out suggestions for node types that already exist
            const suggestedNodes = inference.suggestedNodes.filter(
              (sn) => !existingNames.has(sn.name.toLowerCase()),
            );

            // Only report if there's at least one new suggestion
            if (suggestedNodes.length > 0 || inference.confidence > 0.8) {
              results.push({
                ...inference,
                suggestedNodes,
                confidence: this.adjustConfidence(inference.confidence, nodes, source, target),
              });
            }
          }
        }
      }
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze an edge being created and return immediate suggestions.
   */
  inferForConnection(
    sourceType: string,
    targetType: string,
    edgeType: string,
  ): InferredSubsystem[] {
    for (const pattern of SEMANTIC_PATTERNS) {
      if (
        pattern.sourceTypes.includes(sourceType) &&
        pattern.targetTypes.includes(targetType) &&
        pattern.edgeTypes.includes(edgeType)
      ) {
        return pattern.inferences;
      }
    }
    return [];
  }

  /**
   * Adjust confidence based on existing topology.
   * Higher confidence when fewer of the suggested nodes already exist.
   */
  private adjustConfidence(
    baseConfidence: number,
    nodes: GraphNode[],
    source: GraphNode,
    target: GraphNode,
  ): number {
    let adjusted = baseConfidence;

    // Reduce confidence if nodes already have rich configurations
    if (source.runtime && target.runtime) adjusted -= 0.1;
    if (source.inputs.length > 0 && target.outputs.length > 0) adjusted -= 0.1;

    // Increase confidence for larger graphs (more complex = more need for infrastructure)
    if (nodes.length > 20) adjusted += 0.1;
    if (nodes.length > 50) adjusted += 0.05;

    return Math.min(0.99, Math.max(0.1, adjusted));
  }
}
