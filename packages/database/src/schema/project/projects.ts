import { pgSchema, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const projectSchema = pgSchema('project');

export const projects = projectSchema.table('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  ownerId: uuid('owner_id').notNull(),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectMembers = projectSchema.table('project_members', {
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull().default('viewer'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});
