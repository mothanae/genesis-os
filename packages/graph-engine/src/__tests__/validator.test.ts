import { describe, it, expect } from 'vitest';
import { GraphValidator } from '../validator';
import type { GraphNode, GraphEdge, CycleResult } from '@genesis-1/shared';

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'n1', projectId: 'p1', type: 'service', name: 'Test Service',
    description: null, metadata: {}, position: { x: 0, y: 0 },
    inputs: [], outputs: [], dependencies: [], relationships: [],
    runtime: null, deployment: null, state: 'draft', version: 1,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'e1', projectId: 'p1', source: 'n1', target: 'n2', type: 'depends_on',
    weight: 1, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('GraphValidator', () => {
  const validator = new GraphValidator();

  it('returns valid for empty graph', () => {
    const result = validator.validate([], [], []);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects orphaned nodes with more than 1 node', () => {
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
    const result = validator.validate(nodes, [], []);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === 'ORPHANED_NODE')).toBe(true);
  });

  it('does not flag single connected node', () => {
    const nodes = [makeNode({ id: 'n1' })];
    const result = validator.validate(nodes, [], []);
    expect(result.warnings.some((w) => w.code === 'ORPHANED_NODE')).toBe(false);
  });

  it('detects missing source reference', () => {
    const nodes = [makeNode({ id: 'n1' })];
    const edges = [makeEdge({ id: 'e1', source: 'nonexistent', target: 'n1' })];
    const result = validator.validate(nodes, edges, []);
    expect(result.errors.some((e) => e.code === 'MISSING_SOURCE')).toBe(true);
  });

  it('detects self-referencing edges', () => {
    const nodes = [makeNode({ id: 'n1' })];
    const edges = [makeEdge({ id: 'e1', source: 'n1', target: 'n1' })];
    const result = validator.validate(nodes, edges, []);
    expect(result.errors.some((e) => e.code === 'SELF_REFERENCE')).toBe(true);
  });

  it('detects duplicate edges', () => {
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
    const edges = [
      makeEdge({ id: 'e1', source: 'n1', target: 'n2', type: 'depends_on' }),
      makeEdge({ id: 'e2', source: 'n1', target: 'n2', type: 'depends_on' }),
    ];
    const result = validator.validate(nodes, edges, []);
    expect(result.warnings.some((w) => w.code === 'DUPLICATE_EDGE')).toBe(true);
  });

  it('reports cycles as errors', () => {
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
    const edges = [makeEdge({ id: 'e1', source: 'n1', target: 'n2' })];
    const cycles: CycleResult[] = [{ path: ['n1', 'n2'], nodeIds: ['n1', 'n2'], edgeIds: ['e1'], length: 2 }];
    const result = validator.validate(nodes, edges, cycles);
    expect(result.errors.some((e) => e.code === 'GRAPH_CYCLE')).toBe(true);
    expect(result.suggestions.some((s) => s.code === 'GRAPH_CYCLE_FIX')).toBe(true);
  });

  it('warns on high fan-out (>10 edges from one node)', () => {
    const nodes = [makeNode({ id: 'n1' }), ...Array.from({ length: 11 }, (_, i) => makeNode({ id: `t${i}` }))];
    const edges = Array.from({ length: 11 }, (_, i) => makeEdge({ id: `e${i}`, source: 'n1', target: `t${i}` }));
    const result = validator.validate(nodes, edges, []);
    expect(result.warnings.some((w) => w.code === 'HIGH_FAN_OUT')).toBe(true);
  });

  it('suggests runtime config for services without one', () => {
    const nodes = [makeNode({ id: 'n1', type: 'service', runtime: null })];
    const result = validator.validate(nodes, [], []);
    expect(result.suggestions.some((s) => s.code === 'MISSING_RUNTIME_CONFIG')).toBe(true);
  });

  it('validates known connection patterns', () => {
    const nodes = [
      makeNode({ id: 's1', type: 'service', name: 'API' }),
      makeNode({ id: 'db1', type: 'database', name: 'Postgres' }),
    ];
    const edges = [makeEdge({ id: 'e1', source: 's1', target: 'db1', type: 'writes_to' })];
    const result = validator.validate(nodes, edges, []);
    expect(result.valid).toBe(true);
  });
});
