import { pgSchema, uuid, text, integer, real, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const graphSchema = pgSchema('graph');

export const nodes = graphSchema.table('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  type: text('type').notNull(),
  subtype: text('subtype'),
  name: text('name').notNull(),
  description: text('description'),
  metadata: jsonb('metadata').notNull().default({}),
  positionX: real('position_x').notNull().default(0),
  positionY: real('position_y').notNull().default(0),
  inputs: jsonb('inputs').notNull().default([]),
  outputs: jsonb('outputs').notNull().default([]),
  dependencies: text('dependencies').array().notNull().default([]),
  relationships: text('relationships').array().notNull().default([]),
  runtime: jsonb('runtime'),
  deployment: jsonb('deployment'),
  state: text('state').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  parentId: uuid('parent_id'),
  branchId: uuid('branch_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const edges = graphSchema.table('edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  source: uuid('source')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  target: uuid('target')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  label: text('label'),
  metadata: jsonb('metadata'),
  realtime: boolean('realtime').default(false),
  bidirectional: boolean('bidirectional').default(false),
  weight: real('weight').default(1.0),
  properties: jsonb('properties'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const branches = graphSchema.table('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  parentBranchId: uuid('parent_branch_id'),
  baseSnapshotId: uuid('base_snapshot_id'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const snapshots = graphSchema.table('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  branchId: uuid('branch_id'),
  label: text('label').notNull(),
  description: text('description'),
  nodeCount: integer('node_count').notNull(),
  edgeCount: integer('edge_count').notNull(),
  graphData: jsonb('graph_data').notNull(),
  parentSnapshotId: uuid('parent_snapshot_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const flows = graphSchema.table('flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  nodes: text('nodes').array().notNull().default([]),
  entryNodeId: uuid('entry_node_id').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const flowExecutions = graphSchema.table('flow_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id')
    .notNull()
    .references(() => flows.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull(),
  status: text('status').notNull().default('pending'),
  currentNodeId: uuid('current_node_id'),
  completedNodes: text('completed_nodes').array().notNull().default([]),
  context: jsonb('context').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
});
