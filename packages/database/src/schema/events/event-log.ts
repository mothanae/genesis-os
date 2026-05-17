import { pgSchema, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const eventsSchema = pgSchema('events');

export const eventLog = eventsSchema.table('event_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  source: text('source').notNull(),
  correlationId: uuid('correlation_id'),
  causationId: uuid('causation_id'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
