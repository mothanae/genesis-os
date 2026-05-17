import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventPublisher } from '../publisher';
import { EventType } from '@genesis-1/shared';

function createMockRedis() {
  const pipeline = {
    publish: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
  };

  return {
    publish: vi.fn().mockResolvedValue(1),
    duplicate: vi.fn().mockReturnThis(),
    pipeline: vi.fn().mockReturnValue(pipeline),
    _pipeline: pipeline,
  };
}

describe('EventPublisher', () => {
  let publisher: EventPublisher;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
    publisher = new EventPublisher(redis as any);
  });

  it('publishes an event to the correct channel', async () => {
    const event = {
      id: 'evt-1',
      type: EventType.NodeCreated,
      source: 'graph-engine',
      correlationId: 'corr-1',
      timestamp: new Date().toISOString(),
      projectId: 'proj-1',
      userId: 'user-1',
      payload: { nodeId: 'node-1', type: 'service' },
      metadata: { version: 1, priority: 'normal' as const },
    };

    await publisher.publish('genesis-1.graph.node.created', event as any);

    expect(redis.publish).toHaveBeenCalledWith(
      'genesis-1.graph.node.created',
      expect.any(String),
    );
  });

  it('publishes a batch of events via pipeline', async () => {
    const events = [
      {
        id: 'evt-1',
        type: EventType.NodeCreated,
        source: 'graph-engine',
        correlationId: 'corr-1',
        timestamp: new Date().toISOString(),
        projectId: 'proj-1',
        userId: 'user-1',
        payload: { nodeId: 'node-1' },
        metadata: { version: 1, priority: 'normal' as const },
      },
      {
        id: 'evt-2',
        type: EventType.EdgeCreated,
        source: 'graph-engine',
        correlationId: 'corr-2',
        timestamp: new Date().toISOString(),
        projectId: 'proj-1',
        userId: 'user-1',
        payload: { edgeId: 'edge-1' },
        metadata: { version: 1, priority: 'normal' as const },
      },
    ];

    await publisher.publishBatch('genesis-1.graph.batch', events as any[]);

    expect(redis.pipeline).toHaveBeenCalled();
    expect(redis._pipeline.publish).toHaveBeenCalledTimes(2);
    expect(redis._pipeline.exec).toHaveBeenCalled();
  });

  it('handles publish failure gracefully', async () => {
    redis.publish.mockRejectedValueOnce(new Error('Redis down'));

    const event = {
      id: 'evt-1',
      type: EventType.NodeCreated,
      source: 'test',
      correlationId: 'corr-1',
      timestamp: new Date().toISOString(),
      projectId: 'proj-1',
      payload: {},
      metadata: { version: 1, priority: 'normal' as const },
    };

    // Should throw when Redis is down (caller handles it)
    await expect(
      publisher.publish('genesis-1.graph.node.created', event as any),
    ).rejects.toThrow('Redis down');
  });
});
