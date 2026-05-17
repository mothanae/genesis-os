import { pgSchema, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
