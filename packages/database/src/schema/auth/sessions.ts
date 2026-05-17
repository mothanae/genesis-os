import { authSchema } from './users';
import { uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const sessions = authSchema.table('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authSchema.users.id, { onDelete: 'cascade' }),
  refreshToken: text('refresh_token').unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
