import { pgSchema, uuid, text, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const ruleSchema = pgSchema('rule');

export const ruleSets = ruleSchema.table('rule_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  evaluationStrategy: text('evaluation_strategy').notNull().default('all-match'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ruleDefinitions = ruleSchema.table('rule_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  ruleSetId: uuid('rule_set_id').references(() => ruleSets.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  domain: text('domain').notNull(),
  condition: jsonb('condition').notNull(),
  action: jsonb('action').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  priority: integer('priority').notNull().default(100),
  evaluationMode: text('evaluation_mode').notNull().default('sync'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evaluationResults = ruleSchema.table('evaluation_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id')
    .notNull()
    .references(() => ruleDefinitions.id, { onDelete: 'cascade' }),
  executionId: text('execution_id'),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  matched: boolean('matched').notNull(),
  context: jsonb('context').notNull().default({}),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const violations = ruleSchema.table('violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  evaluationId: uuid('evaluation_id')
    .notNull()
    .references(() => evaluationResults.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id')
    .notNull()
    .references(() => ruleDefinitions.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull(),
  severity: text('severity').notNull(),
  message: text('message').notNull(),
  details: jsonb('details'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
