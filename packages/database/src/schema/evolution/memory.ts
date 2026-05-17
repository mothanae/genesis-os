import { pgSchema, uuid, text, integer, boolean, jsonb, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

export const evolutionSchema = pgSchema('evolution');

export const memoryRecords = evolutionSchema.table('memory_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  snapshotId: uuid('snapshot_id'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  nodeCount: integer('node_count').notNull().default(0),
  edgeCount: integer('edge_count').notNull().default(0),
  nodeTypes: text('node_types').array().notNull().default([]),
  edgeTypes: text('edge_types').array().notNull().default([]),
  insights: jsonb('insights').notNull().default([]),
  templateMatches: jsonb('template_matches').notNull().default([]),
  patterns: text('patterns').array(),
});

export const learnedPatterns = evolutionSchema.table('learned_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  frequency: doublePrecision('frequency').notNull().default(0),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  nodeTypes: text('node_types').array().notNull().default([]),
  edgeTypes: text('edge_types').array().notNull().default([]),
  typicalInsights: text('typical_insights').array().notNull().default([]),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evolutionActions = evolutionSchema.table('evolution_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  actionType: text('action_type').notNull(),
  description: text('description'),
  nodeId: uuid('node_id'),
  edgeId: uuid('edge_id'),
  applied: boolean('applied').notNull().default(false),
  success: boolean('success').notNull().default(false),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
