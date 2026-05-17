import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createClient(databaseUrl: string, options?: { poolMin?: number; poolMax?: number }) {
  const client = postgres(databaseUrl, {
    max: options?.poolMax ?? 20,
    idle_timeout: 10,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export type DatabaseClient = ReturnType<typeof createClient>;
