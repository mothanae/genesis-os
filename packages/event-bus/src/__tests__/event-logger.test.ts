import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventLogger } from '../event-logger';
import { EventType } from '@genesis-1/shared';

describe('EventLogger', () => {
  let logger: EventLogger;
  let mockDb: { insert: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const values = vi.fn().mockReturnThis();
    mockDb = {
      insert: vi.fn().mockReturnValue({ values }),
    };
    logger = new EventLogger(mockDb as never);
  });

  it('persists an event to the event log table', async () => {
    const event = {
      id: 'evt-1',
      type: EventType.NodeCreated,
      source: 'graph-engine',
      correlationId: 'corr-1',
      causationId: undefined,
      timestamp: new Date().toISOString(),
      projectId: 'proj-1',
      payload: { nodeId: 'node-1', type: 'service' },
      metadata: { version: 1, priority: 'normal' as const },
    };

    await logger.persist(event as never);

    expect(mockDb.insert).toHaveBeenCalled();
    const valuesFn = mockDb.insert.mock.results[0]?.value?.values;
    expect(valuesFn).toBeDefined();
  });

  it('persists event with correlationId and causationId', async () => {
    const event = {
      id: 'evt-2',
      type: EventType.AgentExecutionStarted,
      source: 'agent-runtime',
      correlationId: 'corr-chain-1',
      causationId: 'corr-chain-0',
      timestamp: new Date().toISOString(),
      payload: { executionId: 'exec-1' },
      metadata: { version: 1, priority: 'high' as const },
    };

    await logger.persist(event as never);

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('handles events with minimal payload', async () => {
    const event = {
      id: 'evt-3',
      type: EventType.WsClientConnected,
      source: 'ws-server',
      correlationId: 'corr-min',
      timestamp: new Date().toISOString(),
      payload: {},
      metadata: { version: 1, priority: 'normal' as const },
    };

    await logger.persist(event as never);

    expect(mockDb.insert).toHaveBeenCalled();
  });
});
