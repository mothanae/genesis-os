import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventSubscriber } from '../subscriber';
import { EventType } from '@genesis-1/shared';

function createMockRedis() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    }),
    // Helper to simulate incoming messages in tests
    _emitMessage(channel: string, message: string) {
      const handlers = listeners.get('message') ?? [];
      for (const handler of handlers) {
        handler(channel, message);
      }
    },
    _listeners: listeners,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    type: EventType.NodeCreated,
    source: 'test',
    correlationId: 'corr-1',
    timestamp: new Date().toISOString(),
    projectId: 'proj-1',
    payload: { nodeId: 'node-1' },
    metadata: { version: 1, priority: 'normal' as const },
    ...overrides,
  };
}

describe('EventSubscriber', () => {
  let subscriber: EventSubscriber;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
    subscriber = new EventSubscriber(redis as never);
  });

  it('subscribes to a channel and invokes handler on message', async () => {
    const handler = vi.fn();

    await subscriber.subscribe('genesis-1.graph.node.created', handler);

    expect(redis.subscribe).toHaveBeenCalledWith('genesis-1.graph.node.created');

    // Simulate incoming message
    redis._emitMessage('genesis-1.graph.node.created', JSON.stringify(makeEvent()));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'genesis-1.graph.node.created' }),
    );
  });

  it('supports multiple handlers on the same channel', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    await subscriber.subscribe('genesis-1.graph.node.created', handler1);
    await subscriber.subscribe('genesis-1.graph.node.created', handler2);

    // Redis subscribe should only be called once (first handler)
    expect(redis.subscribe).toHaveBeenCalledTimes(1);

    redis._emitMessage('genesis-1.graph.node.created', JSON.stringify(makeEvent()));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('ignores messages on other channels', async () => {
    const handler = vi.fn();
    await subscriber.subscribe('genesis-1.graph.node.created', handler);

    redis._emitMessage('genesis-1.graph.edge.created', JSON.stringify(makeEvent()));

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes a single handler while keeping others', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const sub = await subscriber.subscribe('genesis-1.graph.node.created', handler1);
    await subscriber.subscribe('genesis-1.graph.node.created', handler2);

    await sub.unsubscribe();

    redis._emitMessage('genesis-1.graph.node.created', JSON.stringify(makeEvent()));

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes channel from Redis when last handler is removed', async () => {
    const sub = await subscriber.subscribe('genesis-1.graph.node.created', vi.fn());

    await sub.unsubscribe();

    expect(redis.unsubscribe).toHaveBeenCalledWith('genesis-1.graph.node.created');
  });

  it('returns a subscription with channel and unsubscribe', async () => {
    const handler = vi.fn();
    const sub = await subscriber.subscribe('test-channel', handler);

    expect(sub.channel).toBe('test-channel');
    expect(sub.handler).toBe(handler);
    expect(typeof sub.unsubscribe).toBe('function');
  });

  it('handles malformed JSON silently', async () => {
    const handler = vi.fn();
    await subscriber.subscribe('test-channel', handler);

    // Should not throw
    expect(() => redis._emitMessage('test-channel', 'not valid json{{{')).not.toThrow();

    // Handler should not be called for malformed messages
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles multiple channels independently', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    await subscriber.subscribe('channel-a', handler1);
    await subscriber.subscribe('channel-b', handler2);

    redis._emitMessage('channel-a', JSON.stringify(makeEvent({ type: EventType.NodeCreated })));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it('close() unsubscribes all channels', async () => {
    await subscriber.subscribe('channel-a', vi.fn());
    await subscriber.subscribe('channel-b', vi.fn());

    await subscriber.close();

    expect(redis.unsubscribe).toHaveBeenCalledWith('channel-a', 'channel-b');
  });

  it('close() on empty subscriber does not call unsubscribe', async () => {
    await subscriber.close();

    expect(redis.unsubscribe).not.toHaveBeenCalled();
  });
});
