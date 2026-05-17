import { describe, it, expect } from 'vitest';
import { ArchitectureDiagrams } from '../diagrams';
import type { GraphNode, GraphEdge } from '@genesis-1/shared';

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'n1', projectId: 'p1', type: 'service', name: 'API Service',
    description: 'Main API', metadata: {}, position: { x: 0, y: 0 },
    inputs: [], outputs: [], dependencies: [], relationships: [],
    runtime: { replicas: 2, memory: '512Mi' }, deployment: null,
    state: 'active', version: 1,
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

describe('ArchitectureDiagrams', () => {
  const diagrams = new ArchitectureDiagrams();
  const nodes = [
    makeNode({ id: 'n1', type: 'service', name: 'API' }),
    makeNode({ id: 'n2', type: 'database', name: 'Postgres' }),
    makeNode({ id: 'n3', type: 'cache', name: 'Redis' }),
  ];
  const edges = [
    makeEdge({ id: 'e1', source: 'n1', target: 'n2', type: 'writes_to' }),
    makeEdge({ id: 'e2', source: 'n1', target: 'n3', type: 'reads_from' }),
  ];

  it('generates Mermaid diagram', () => {
    const result = diagrams.generate(nodes, edges, { format: 'mermaid', title: 'Test' });
    expect(result).toContain('graph TB');
    expect(result).toContain('API');
    expect(result).toContain('Postgres');
    expect(result).toContain('Redis');
    expect(result).toContain('classDef service');
    expect(result).toContain('classDef database');
    expect(result).toContain('classDef cache');
  });

  it('generates Graphviz DOT', () => {
    const result = diagrams.generate(nodes, edges, { format: 'graphviz' });
    expect(result).toContain('digraph G');
    expect(result).toContain('rankdir=TB');
    expect(result).toContain('->');
    expect(result).toContain('writes_to');
  });

  it('generates D2 diagram', () => {
    const result = diagrams.generate(nodes, edges, { format: 'd2' });
    expect(result).toContain('direction: down');
    expect(result).toContain('->');
  });

  it('generates PlantUML', () => {
    const result = diagrams.generate(nodes, edges, { format: 'plantuml' });
    expect(result).toContain('@startuml');
    expect(result).toContain('@enduml');
  });

  it('supports LR direction', () => {
    const result = diagrams.generate(nodes, edges, { format: 'mermaid', direction: 'LR' });
    expect(result).toContain('graph LR');
  });

  it('includes title comment', () => {
    const result = diagrams.generate(nodes, edges, { format: 'mermaid', title: 'My Architecture' });
    expect(result).toContain('My Architecture');
  });

  it('shows runtime info when enabled', () => {
    const result = diagrams.generate(nodes, edges, { format: 'mermaid', showRuntime: true });
    expect(result).toContain('replicas');
  });

  it('groups by environment when enabled', () => {
    const envNodes = [
      makeNode({ id: 'env1', type: 'environment', name: 'Production' }),
      ...nodes,
    ];
    const envEdges = [
      makeEdge({ id: 'e0', source: 'env1', target: 'n1', type: 'contains' }),
      ...edges,
    ];
    const result = diagrams.generate(envNodes, envEdges, { format: 'mermaid', groupByEnvironment: true });
    expect(result).toContain('subgraph');
    expect(result).toContain('Production');
  });
});
