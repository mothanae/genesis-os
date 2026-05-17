import { describe, it, expect, vi } from 'vitest';
import { SelfHealer } from '../self-healer';
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

function createMockGraphEngine() {
  return {
    createEdge: vi.fn().mockResolvedValue(undefined),
    updateNode: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('SelfHealer', () => {
  it('detects and connects orphaned node to parent context', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 'env1', type: 'environment', name: 'Production' }),
      makeNode({ id: 'orphan1', type: 'service', name: 'Orphan Service' }),
    ];
    const edges: GraphEdge[] = [];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const orphanAction = actions.find((a) => a.type === 'remove_orphan');
    expect(orphanAction).toBeDefined();
    expect(orphanAction!.applied).toBe(true);
    expect(orphanAction!.success).toBe(true);
    expect(graphEngine.createEdge).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        type: 'contains',
      }),
    );
  });

  it('adds health check config to service without one', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 'svc1', type: 'service', name: 'My Service', runtime: null }),
    ];
    const edges: GraphEdge[] = [];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const healthAction = actions.find((a) => a.type === 'add_runtime_config');
    expect(healthAction).toBeDefined();
    expect(healthAction!.applied).toBe(true);
    expect(graphEngine.updateNode).toHaveBeenCalledWith(
      'svc1',
      expect.objectContaining({
        runtime: expect.objectContaining({
          healthCheck: expect.objectContaining({ path: '/health' }),
        }),
      }),
    );
  });

  it('skips health check for service that already has one', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({
        id: 'svc1',
        type: 'service',
        name: 'Healthy Service',
        runtime: { healthCheck: { path: '/health' } },
      }),
    ];
    const edges: GraphEdge[] = [];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const healthAction = actions.find((a) => a.type === 'add_runtime_config');
    expect(healthAction).toBeUndefined();
  });

  it('adds default HTTP output port to services without ports', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 'svc1', type: 'service', name: 'Portless Service', outputs: [] }),
    ];
    const edges: GraphEdge[] = [];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const portAction = actions.find((a) => a.type === 'fix_port');
    expect(portAction).toBeDefined();
    expect(portAction!.applied).toBe(true);
    expect(graphEngine.updateNode).toHaveBeenCalledWith(
      'svc1',
      expect.objectContaining({
        outputs: expect.arrayContaining([
          expect.objectContaining({ name: 'HTTP', type: 'data' }),
        ]),
      }),
    );
  });

  it('flags missing auth when API gateway exists without auth service', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 'gw1', type: 'api_gateway', name: 'Gateway' }),
      makeNode({ id: 'svc1', type: 'service', name: 'Backend', outputs: [{ id: 'p1', name: 'HTTP', type: 'data', direction: 'output' }] }),
    ];
    const edges = [makeEdge({ source: 'gw1', target: 'svc1', type: 'routes_to' })];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const authAction = actions.find((a) => a.type === 'add_auth');
    expect(authAction).toBeDefined();
    expect(authAction!.description).toContain('auth');
  });

  it('suggests event bus when many services have direct communication edges', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 's1', type: 'service', name: 'Svc1', outputs: [{ id: 'p1', name: 'HTTP', type: 'data', direction: 'output' }] }),
      makeNode({ id: 's2', type: 'service', name: 'Svc2', outputs: [{ id: 'p2', name: 'HTTP', type: 'data', direction: 'output' }] }),
      makeNode({ id: 's3', type: 'service', name: 'Svc3', outputs: [{ id: 'p3', name: 'HTTP', type: 'data', direction: 'output' }] }),
      makeNode({ id: 's4', type: 'service', name: 'Svc4', outputs: [{ id: 'p4', name: 'HTTP', type: 'data', direction: 'output' }] }),
    ];
    const edges = [
      makeEdge({ source: 's1', target: 's2', type: 'communicates_with' }),
      makeEdge({ source: 's2', target: 's3', type: 'communicates_with' }),
      makeEdge({ source: 's3', target: 's4', type: 'communicates_with' }),
      makeEdge({ source: 's1', target: 's3', type: 'depends_on' }),
      makeEdge({ source: 's2', target: 's4', type: 'depends_on' }),
      makeEdge({ source: 's4', target: 's1', type: 'depends_on' }),
    ];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const eventBusAction = actions.find((a) => a.type === 'add_event_bus');
    expect(eventBusAction).toBeDefined();
  });

  it('flags database with high fan-in', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 'db1', type: 'database', name: 'Main DB' }),
    ];
    // Add 6 services writing to it
    for (let i = 0; i < 6; i++) {
      nodes.push(makeNode({
        id: `svc${i}`,
        type: 'service',
        name: `Service ${i}`,
        outputs: [{ id: `p${i}`, name: 'HTTP', type: 'data', direction: 'output' }],
      }));
    }
    const edges = nodes
      .filter((n) => n.type === 'service')
      .map((n) => makeEdge({ source: n.id, target: 'db1', type: 'writes_to' }));

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const fanInAction = actions.find((a) => a.type === 'recommend_data_service');
    expect(fanInAction).toBeDefined();
    expect(fanInAction!.description).toContain('data service');
  });

  it('flags missing rate limiter when API gateway exists', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 'gw1', type: 'api_gateway', name: 'Gateway', outputs: [{ id: 'p1', name: 'HTTP', type: 'data', direction: 'output' }] }),
      makeNode({ id: 'svc1', type: 'service', name: 'Backend', outputs: [{ id: 'p2', name: 'HTTP', type: 'data', direction: 'output' }] }),
    ];
    const edges = [makeEdge({ source: 'gw1', target: 'svc1', type: 'routes_to' })];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    const rateAction = actions.find((a) => a.type === 'add_rate_limiter');
    expect(rateAction).toBeDefined();
  });

  it('heals orphan by connecting to nearest service when no parent context exists', async () => {
    const graphEngine = createMockGraphEngine();
    const healer = new SelfHealer(graphEngine);

    const nodes = [
      makeNode({ id: 'svc1', type: 'service', name: 'Existing Service' }),
      makeNode({ id: 'orphan1', type: 'database', name: 'Orphan DB' }),
    ];
    const edges: GraphEdge[] = [];

    const actions = await healer.heal(nodes, edges, 'proj-1');

    // Find the orphan action for the database node (orphan1)
    const orphanAction = actions.find(
      (a) => a.type === 'remove_orphan' && a.nodeId === 'orphan1',
    );
    expect(orphanAction).toBeDefined();
    expect(orphanAction!.applied).toBe(true);
    expect(orphanAction!.description).toContain('depends_on');
  });
});
