import type { Redis } from 'ioredis';
import type { EventEnvelope } from '@genesis-1/shared';
import type { EventHandler, Subscription } from './types';

export class EventSubscriber {
  private readonly subscriptions = new Map<string, Set<EventHandler>>();
  private listenerRegistered = false;

  constructor(private readonly redis: Redis) {}

  async subscribe(channel: string, handler: EventHandler): Promise<Subscription> {
    let handlers = this.subscriptions.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.subscriptions.set(channel, handlers);
      await this.redis.subscribe(channel);
    }
    handlers.add(handler);

    // Register the message listener once globally
    if (!this.listenerRegistered) {
      this.listenerRegistered = true;
      this.redis.on('message', (ch, message) => {
        try {
          const event = JSON.parse(message) as EventEnvelope;
          const subs = this.subscriptions.get(ch);
          if (subs) {
            for (const h of subs) {
              void h(event);
            }
          }
        } catch {
          // Skip malformed messages
        }
      });
    }

    return {
      channel,
      handler,
      unsubscribe: async () => {
        await this.unsubscribe(channel, handler);
      },
    };
  }

  private async unsubscribe(channel: string, handler: EventHandler): Promise<void> {
    const handlers = this.subscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(channel);
        await this.redis.unsubscribe(channel);
      }
    }
  }

  async close(): Promise<void> {
    const channels = Array.from(this.subscriptions.keys());
    if (channels.length > 0) {
      await this.redis.unsubscribe(...channels);
    }
    this.subscriptions.clear();
  }
}
