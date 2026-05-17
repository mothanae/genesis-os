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

  private subscribed = false;

  /**
   * Subscribe to Redis events and forward to connected Socket.IO clients.
   * Listens on channel patterns for graph, agent, simulation, and rule events.
   */
  async subscribeToRedisChannels(): Promise<void> {
    if (this.subscribed) return;
    this.subscribed = true;

    const subscriber = this.redis.duplicate();

    const channels = [
      'graph.*',
      'agent.*',
      'simulation.*',
      'rule.*',
      'genesis-1.*',
    ];

    await subscriber.subscribe(...channels);

    subscriber.on('message', (channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as SocketIOEvent & {
          type?: string;
          projectId?: string;
          payload?: Record<string, unknown>;
        };

        const room = parsed.room
          ?? (parsed.projectId ? `project:${parsed.projectId}` : undefined);

        const eventName = parsed.event
          ?? (parsed.type ? `${channel}.${parsed.type}` : channel);

        const data = parsed.data ?? parsed.payload ?? parsed;

        if (this.io) {
          const io = this.io as {
            of: (ns: string) => {
              to: (room: string) => { emit: (event: string, data: unknown) => void };
              emit: (event: string, data: unknown) => void;
            };
          };
          const ns = io.of(this.namespace);

          if (room) {
            ns.to(room).emit(eventName, data);
          } else {
            ns.emit(eventName, data);
          }
        } else {
          // Queue event for later delivery when io connects
          this.pendingEvents.push({ event: eventName, data, room, namespace: this.namespace });
          if (this.pendingEvents.length > 1000) {
            this.pendingEvents = this.pendingEvents.slice(-500);
          }
        }
      } catch {
        // Skip malformed messages
      }
    });
  }

  /**
   * Flush pending events to a newly connected Socket.IO server.
   */
  flushPending(io: unknown): void {
    if (!io || this.pendingEvents.length === 0) return;

    const socketIO = io as {
      of: (ns: string) => {
        to: (room: string) => { emit: (event: string, data: unknown) => void };
        emit: (event: string, data: unknown) => void;
      };
    };

    const ns = socketIO.of(this.namespace);
    const batch = this.pendingEvents.splice(0);

    for (const evt of batch) {
      if (evt.room) {
        ns.to(evt.room).emit(evt.event, evt.data);
      } else {
        ns.emit(evt.event, evt.data);
      }
    }
  }

  /**
   * Get stats about pending events.
   */
  getStats(): { pendingEvents: number; subscribed: boolean } {
    return { pendingEvents: this.pendingEvents.length, subscribed: this.subscribed };
  }
}
