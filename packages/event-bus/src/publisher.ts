import type { Redis } from 'ioredis';
import type { EventEnvelope } from '@genesis-1/shared';

export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(channel: string, event: EventEnvelope): Promise<void> {
    const message = JSON.stringify(event);
    await this.redis.publish(channel, message);
  }

  async publishBatch(channel: string, events: EventEnvelope[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const event of events) {
      pipeline.publish(channel, JSON.stringify(event));
    }
    await pipeline.exec();
  }
}
