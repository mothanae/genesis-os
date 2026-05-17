import type { DatabaseClient } from '@genesis-1/database';
import type { EventEnvelope } from '@genesis-1/shared';
import { eventLog } from '@genesis-1/database';

export class EventLogger {
  constructor(private readonly db: DatabaseClient) {}

  async persist(event: EventEnvelope): Promise<void> {
    await this.db.insert(eventLog).values({
      eventType: event.type,
      source: event.source,
      correlationId: event.correlationId,
      causationId: event.causationId,
      payload: event.payload as Record<string, unknown>,
    });
  }
}
