import { pgSchema, uuid, text, integer, float, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const simulationSchema = pgSchema('simulation');

export const simulationDefinitions = simulationSchema.table('simulation_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  initialState: jsonb('initial_state').notNull(),
  eventGenerators: jsonb('event_generators').notNull().default([]),
  rulesConfig: jsonb('rules_config').notNull().default({}),
  termination: jsonb('termination').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const simulationRuns = simulationSchema.table('simulation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  definitionId: uuid('definition_id')
    .notNull()
    .references(() => simulationDefinitions.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull(),
  triggeredBy: uuid('triggered_by').notNull(),
  status: text('status').notNull().default('pending'),
  totalSteps: integer('total_steps').notNull().default(0),
  clockEnd: float('clock_end').notNull().default(0),
  metrics: jsonb('metrics'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const simulationEvents = simulationSchema.table('simulation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => simulationRuns.id, { onDelete: 'cascade' }),
  simTime: float('sim_time').notNull(),
  eventType: text('event_type').notNull(),
  source: text('source'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
