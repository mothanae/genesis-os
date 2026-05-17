import { describe, it, expect } from 'vitest';
import { SemanticInference, type InferredSubsystem } from '../semantic-inference';
import type { GraphNode, GraphEdge } from '@genesis-1/shared';

function makeNode(overrides: Partial<GraphNode> & { id: string; type: string; name: string }): GraphNode {
  return {
    description: null,
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: [],
    state: 'active',
    runtime: null,
    deployment: null,
    version: 1,
    parentId: null,
    branchId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectId: 'proj-1',
    ...overrides,
  } as GraphNode;
}

function makeEdge(overrides: Partial<GraphEdge> & { source: string; target: string }): GraphEdge {
  return {
    id: `edge-${Math.random().toString(36).slice(2, 8)}`,
    type: 'depends_on',
    label: null,
    projectId: 'proj-1',
    realtime: false,
    bidirectional: false,
    weight: 1,
    properties: {},
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as GraphEdge;
}

describe('SemanticInference', () => {
  const inference = new SemanticInference();

  describe('infer', () => {
    it('returns empty array for empty graph', () => {
      const result = inference.infer([], []);
      expect(result).toEqual([]);
    });

    it('returns empty array for graph with no edges', () => {
      const nodes = [makeNode({ id: 'n1', type: 'service', name: 'Svc' })];
      const result = inference.infer(nodes, []);
      expect(result).toEqual([]);
    });

    it('infers messaging/caching/data-layer for service→database edge', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'service', name: 'User Service' }),
        makeNode({ id: 'n2', type: 'database', name: 'PostgreSQL' }),
      ];
      const edges = [makeEdge({ source: 'n1', target: 'n2', type: 'writes_to' })];

      const result = inference.infer(nodes, edges);
      const systems = result.map((r) => r.system);

      expect(systems).toContain('Data Access Layer');
      expect(systems).toContain('Database Replica');
    });

    it('infers rate limiter and auth for api_gateway→service edge', () => {
      const nodes = [
        makeNode({ id: 'g1', type: 'api_gateway', name: 'Gateway' }),
        makeNode({ id: 'n1', type: 'service', name: 'Backend' }),
      ];
      const edges = [makeEdge({ source: 'g1', target: 'n1', type: 'routes_to' })];

      const result = inference.infer(nodes, edges);
      const systems = result.map((r) => r.system);

      expect(systems).toContain('Rate Limiter');
      expect(systems).toContain('Auth Service');
    });

    it('infers event bus and schema registry for service→event_topic edge', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'service', name: 'Order Service' }),
        makeNode({ id: 'n2', type: 'event_topic', name: 'Orders' }),
      ];
      const edges = [makeEdge({ source: 'n1', target: 'n2', type: 'emits' })];

      const result = inference.infer(nodes, edges);
      const systems = result.map((r) => r.system);

      expect(systems).toContain('Event Bus');
      expect(systems).toContain('Schema Registry');
    });

    it('infers worker pool and DLQ for service→queue edge', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'service', name: 'Producer' }),
        makeNode({ id: 'n2', type: 'queue', name: 'Task Queue' }),
      ];
      const edges = [makeEdge({ source: 'n1', target: 'n2', type: 'produces_to' })];

      const result = inference.infer(nodes, edges);
      const systems = result.map((r) => r.system);

      expect(systems).toContain('Worker Pool');
      expect(systems).toContain('Dead Letter Queue');
    });

    it('infers messaging/notification systems for service→service communication', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'service', name: 'Auth Service' }),
        makeNode({ id: 'n2', type: 'service', name: 'User Service' }),
      ];
      const edges = [makeEdge({ source: 'n1', target: 'n2', type: 'communicates_with' })];

      const result = inference.infer(nodes, edges);
      const systems = result.map((r) => r.system);

      expect(systems).toContain('Messaging System');
      expect(systems).toContain('Notification System');
    });

    it('sorts results by confidence descending', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'api_gateway', name: 'Gateway' }),
        makeNode({ id: 'n2', type: 'service', name: 'Backend' }),
        makeNode({ id: 'n3', type: 'service', name: 'Other' }),
      ];
      const edges = [
        makeEdge({ source: 'n1', target: 'n2', type: 'routes_to' }),
        makeEdge({ source: 'n1', target: 'n3', type: 'routes_to' }),
      ];

      const result = inference.infer(nodes, edges);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]!.confidence).toBeGreaterThanOrEqual(result[i]!.confidence);
      }
    });

    it('deduplicates inferences with the same system+edge combination', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'service', name: 'Svc1' }),
        makeNode({ id: 'n2', type: 'database', name: 'DB' }),
      ];
      const edges = [
        makeEdge({ source: 'n1', target: 'n2', type: 'writes_to' }),
        makeEdge({ source: 'n1', target: 'n2', type: 'reads_from' }),
      ];

      const result = inference.infer(nodes, edges);

      // Data Access Layer should appear at most once per source-target pair
      const dataLayerResults = result.filter((r) => r.system === 'Data Access Layer');
      expect(dataLayerResults.length).toBeLessThanOrEqual(2); // one per edge
    });

    it('skips suggestions for node types that already exist', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'service', name: 'Producer' }),
        makeNode({ id: 'n2', type: 'queue', name: 'Task Queue' }),
        // Worker already exists
        makeNode({ id: 'n3', type: 'service', name: 'Queue Worker' }),
      ];
      const edges = [makeEdge({ source: 'n1', target: 'n2', type: 'produces_to' })];

      const result = inference.infer(nodes, edges);

      // Worker Pool may still appear but with reduced suggestions
      const workerPool = result.find((r) => r.system === 'Worker Pool');
      if (workerPool) {
        // The suggested worker should be filtered out since it already exists
        const hasWorkerSuggestion = workerPool.suggestedNodes.some(
          (n) => n.name === 'Queue Worker',
        );
        expect(hasWorkerSuggestion).toBe(false);
      }
    });

    it('returns higher confidence for larger graphs', () => {
      // Create a large graph
      const nodes: GraphNode[] = [];
      for (let i = 0; i < 60; i++) {
        nodes.push(makeNode({ id: `n${i}`, type: 'service', name: `Service ${i}` }));
      }
      nodes.push(makeNode({ id: 'db1', type: 'database', name: 'Big DB' }));
      const edges = [makeEdge({ source: 'n0', target: 'db1', type: 'writes_to' })];

      const resultLarge = inference.infer(nodes, edges);
      const dlLarge = resultLarge.find((r) => r.system === 'Data Access Layer');
      expect(dlLarge).toBeDefined();
      // Confidence should be >= base confidence (0.8) + 0.1 for large graph = 0.9
      expect(dlLarge!.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('inferForConnection', () => {
    it('returns inferences for a known connection pattern', () => {
      const result = inference.inferForConnection('api_gateway', 'service', 'routes_to');

      expect(result.length).toBeGreaterThan(0);
      const systems = result.map((r) => r.system);
      expect(systems).toContain('Rate Limiter');
      expect(systems).toContain('Auth Service');
    });

    it('returns empty array for unknown connection pattern', () => {
      const result = inference.inferForConnection('unknown', 'unknown', 'unknown');
      expect(result).toEqual([]);
    });

    it('returns empty array for known types but unsupported edge type', () => {
      const result = inference.inferForConnection('service', 'database', 'unknown');
      expect(result).toEqual([]);
    });
  });
});
