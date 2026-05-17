import { pgSchema, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const agentSchema = pgSchema('agent');

export const agentDefinitions = agentSchema.table('agent_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  graphDefinition: jsonb('graph_definition').notNull(),
  toolsConfig: jsonb('tools_config').notNull().default([]),
  modelConfig: jsonb('model_config').notNull(),
  prompts: jsonb('prompts').notNull().default({}),
  interruptConfig: jsonb('interrupt_config').notNull().default({}),
  version: integer('version').notNull().default(1),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const executions = agentSchema.table('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull(),
  triggeredBy: uuid('triggered_by').notNull(),
  status: text('status').notNull().default('pending'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  totalDurationMs: integer('total_duration_ms'),
  totalLlmCalls: integer('total_llm_calls').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  checkpointData: jsonb('checkpoint_data'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const executionSteps = agentSchema.table('execution_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id')
    .notNull()
    .references(() => executions.id, { onDelete: 'cascade' }),
  stepType: text('step_type').notNull(),
  nodeName: text('node_name').notNull(),
  status: text('status').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  llmCallDurationMs: integer('llm_call_duration_ms'),
  tokenCount: integer('token_count'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
});
