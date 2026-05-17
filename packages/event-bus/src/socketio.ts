/**
 * Socket.IO Adapter for Genesis-1 Event Bus
 *
 * Bridges Redis pub/sub events to Socket.IO rooms.
 * This allows Socket.IO clients to receive real-time events
 * without directly connecting to Redis.
 */

import type { Redis } from 'ioredis';

export interface SocketIOAdapterConfig {
  redis: Redis;
  io?: unknown; // Socket.IO Server instance (optional — uses Redis pub/sub if not provided)
}

interface SocketIOEvent {
  event: string;
  data: unknown;
  room?: string;
  namespace?: string;
}

export class SocketIOAdapter {
  private redis: Redis;
  private io: unknown;
  private namespace = '/genesis';
  private pendingEvents: SocketIOEvent[] = [];

  constructor(config: SocketIOAdapterConfig) {
    this.redis = config.redis;
    this.io = config.io;
  }

  /**
   * Emit an event to a Socket.IO room. Falls back to Redis pub/sub if no io instance.
   */
  async emit(event: string, data: unknown, room?: string): Promise<void> {
    if (this.io) {
      const io = this.io as {
        of: (ns: string) => { to: (room: string) => { emit: (event: string, data: unknown) => void } };
      };
      const ns = io.of(this.namespace);
      if (room) {
        ns.to(room).emit(event, data);
      } else {
        ns.to('*' as never).emit(event, data);
      }
    }

    // Always publish to Redis for multi-instance support
    await this.redis.publish(
      `socketio:${room ?? 'broadcast'}`,
      JSON.stringify({ event, data, room, namespace: this.namespace }),
    );
  }

  /**
   * Bridge a Graph Engine event to Socket.IO.
   */
  async bridgeGraphEvent(type: string, projectId: string, data: unknown): Promise<void> {
    const room = `project:${projectId}:graph`;
    await this.emit(`graph.${type}`, data, room);
  }

  /**
   * Bridge an Agent Execution event to Socket.IO.
   */
  async bridgeAgentEvent(type: string, projectId: string, executionId: string, data: unknown): Promise<void> {
    const room = `project:${projectId}:agent:${executionId}`;
    await this.emit(`agent.${type}`, data, room);
  }

  /**
   * Bridge a Simulation event to Socket.IO.
   */
  async bridgeSimulationEvent(type: string, projectId: string, runId: string, data: unknown): Promise<void> {
    const room = `project:${projectId}:simulation:${runId}`;
    await this.emit(`simulation.${type}`, data, room);
  }

  /**
   * Subscribe to Redis events and forward to connected Socket.IO clients.
   */
  async subscribeToRedisChannels(): Promise<void> {
    // In a real implementation, this would use ioredis subscribe
    // to listen on graph.*, agent.*, simulation.* channels
    // and forward events to the appropriate Socket.IO rooms.
  }

  /**
   * Get stats about pending events.
   */
  getStats(): { pendingEvents: number } {
    return { pendingEvents: this.pendingEvents.length };
  }
}
