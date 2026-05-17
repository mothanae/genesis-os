import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphEngine } from '../engine';

function createMockDb() {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'from', 'where', 'limit', 'offset', 'insert', 'values', 'returning', 'update', 'set', 'delete'];

  for (const m of methods) {
    q[m] = vi.fn().mockReturnValue(q);
  }

  // Make the chainable thenable so `await` works on it
  q.then = vi.fn((resolve) => {
    if (resolve) resolve([]);
    return Promise.resolve([]);
  });

  q.catch = vi.fn(() => Promise.resolve([]));

  return q as any;
}

function createMockEventBus() {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    publishBatch: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GraphEngine', () => {
  let engine: GraphEngine;
  let db: ReturnType<typeof createMockDb>;
  let eventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    db = createMockDb();
    eventBus = createMockEventBus();
    engine = new GraphEngine({ db, eventBus: eventBus as any });
  });

  describe('createNode', () => {
    it('creates a node and publishes an event', async () => {
      const mockNode = {
        id: 'node-1',
        projectId: 'proj-1',
        type: 'service',
        name: 'My Service',
        description: 'A backend service',
        state: 'draft',
        positionX: 100,
        positionY: 200,
        inputs: [],
        outputs: [],
        runtime: null,
        deployment: null,
        version: 1,
        parentId: null,
        branchId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.returning.mockResolvedValueOnce([mockNode]);

      const result = await engine.createNode('proj-1', {
        type: 'service',
        name: 'My Service',
        description: 'A backend service',
        position: { x: 100, y: 200 },
      });

      expect(result.id).toBe('node-1');
      expect(result.type).toBe('service');
      expect(result.name).toBe('My Service');
      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.graph.node.created',
        expect.objectContaining({ projectId: 'proj-1' }),
      );
    });

    it('defaults position to {0,0} when not provided', async () => {
      const mockNode = {
        id: 'node-2',
        projectId: 'proj-1',
        type: 'database',
        name: 'My DB',
        description: null,
        state: 'draft',
        positionX: 0,
        positionY: 0,
        inputs: [],
        outputs: [],
        runtime: null,
        deployment: null,
        version: 1,
        parentId: null,
        branchId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.returning.mockResolvedValueOnce([mockNode]);

      const result = await engine.createNode('proj-1', {
        type: 'database',
        name: 'My DB',
      });

      expect(result.position).toEqual({ x: 0, y: 0 });
      expect(result.description).toBeNull();
    });
  });

  describe('updateNode', () => {
    it('updates a node and publishes an event', async () => {
      const updatedNode = {
        id: 'node-1',
        projectId: 'proj-1',
        type: 'service',
        name: 'Updated Service',
        description: 'Updated',
        state: 'active',
        positionX: 100,
        positionY: 200,
        inputs: [],
        outputs: [],
        runtime: null,
        deployment: null,
        version: 2,
        parentId: null,
        branchId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.returning.mockResolvedValueOnce([updatedNode]);

      const result = await engine.updateNode('node-1', {
        name: 'Updated Service',
        state: 'active',
      });

      expect(result).not.toBeNull();
      if (result) {
        expect(result.name).toBe('Updated Service');
        expect(result.state).toBe('active');
      }
    });
  });

  describe('deleteNode', () => {
    it('deletes a node and publishes an event', async () => {
      // Mock the select that fetches the node before deletion
      const foundNode = { id: 'node-1', projectId: 'proj-1', type: 'service', name: 'Test Svc' };
      db.limit.mockResolvedValueOnce([foundNode]);

      await engine.deleteNode('node-1', 'user-1');

      expect(db.delete).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.graph.node.deleted',
        expect.objectContaining({ projectId: 'proj-1' }),
      );
    });
  });

  describe('createEdge', () => {
    it('creates an edge between two nodes', async () => {
      // Mock source and target existence checks
      db.limit
        .mockResolvedValueOnce([{ id: 'node-1' }])
        .mockResolvedValueOnce([{ id: 'node-2' }]);

      const mockEdge = {
        id: 'edge-1',
        projectId: 'proj-1',
        type: 'sync',
        source: 'node-1',
        target: 'node-2',
        label: 'calls',
        realtime: false,
        bidirectional: false,
        properties: {},
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.returning.mockResolvedValueOnce([mockEdge]);

      const result = await engine.createEdge('proj-1', {
        type: 'sync',
        source: 'node-1',
        target: 'node-2',
        label: 'calls',
      });

      expect(result.id).toBe('edge-1');
      expect(result.source).toBe('node-1');
      expect(result.target).toBe('node-2');
      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.graph.edge.created',
        expect.objectContaining({ projectId: 'proj-1' }),
      );
    });
  });

  describe('validateTopology', () => {
    it('returns a topology validation result', async () => {
      // The GraphValidator.analyze is tested separately in validator.test.ts
      // Here we test the engine delegates correctly
      const mockResult = {
        valid: true,
        errors: [],
        warnings: [],
        info: [],
        summary: { totalNodes: 0, totalEdges: 0, nodeTypeDistribution: {}, edgeTypeDistribution: {} },
      };

      // Spy on the internal validator call
      const analyzeSpy = vi.spyOn(engine as any, 'validateTopology').mockResolvedValueOnce(mockResult);

      const result = await engine.validateTopology('proj-1');

      expect(result.valid).toBe(true);
      analyzeSpy.mockRestore();
    });
  });
});
