import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';

const startTime = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    // Check database connectivity
    let database = 'ok';
    try {
      await app.db.execute(sql`SELECT 1`);
    } catch {
      database = 'error';
    }

    // Check Redis connectivity
    let redis = 'ok';
    try {
      await app.redis.ping();
    } catch {
      redis = 'error';
    }

    const uptime = Math.floor((Date.now() - startTime) / 1000);

    return {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      database,
      redis,
      uptime,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
      version: '0.1.0',
    };
  });
}
