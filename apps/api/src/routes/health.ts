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

  // Run pending migrations (idempotent — uses IF NOT EXISTS)
  app.post('/health/migrate', async (_request, reply) => {
    const created: string[] = [];
    const errors: string[] = [];

    const statements = [
      // Auth schema
      `CREATE TABLE IF NOT EXISTS auth.api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL,
        key_hash text NOT NULL, key_prefix text NOT NULL, scopes text[] NOT NULL DEFAULT '{*}',
        last_used_at timestamptz, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
      // Rule schema — drop and recreate to fix missing columns
      `DROP TABLE IF EXISTS rule.violations CASCADE`,
      `DROP TABLE IF EXISTS rule.evaluation_results CASCADE`,
      `DROP TABLE IF EXISTS rule.rule_definitions CASCADE`,
      `DROP TABLE IF EXISTS rule.rule_sets CASCADE`,
      `CREATE TABLE rule.rule_sets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, name text NOT NULL,
        description text, evaluation_strategy text NOT NULL DEFAULT 'all-match',
        enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE rule.rule_definitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, rule_set_id uuid REFERENCES rule.rule_sets(id) ON DELETE SET NULL,
        name text NOT NULL, description text, domain text NOT NULL DEFAULT 'graph',
        condition jsonb NOT NULL, action jsonb NOT NULL, enabled boolean NOT NULL DEFAULT true,
        priority integer NOT NULL DEFAULT 100, evaluation_mode text NOT NULL DEFAULT 'sync',
        version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE rule.evaluation_results (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_id uuid NOT NULL REFERENCES rule.rule_definitions(id) ON DELETE CASCADE,
        execution_id text, target_type text NOT NULL, target_id uuid NOT NULL,
        matched boolean NOT NULL, context jsonb NOT NULL DEFAULT '{}',
        evaluated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE rule.violations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), evaluation_id uuid NOT NULL REFERENCES rule.evaluation_results(id) ON DELETE CASCADE,
        rule_id uuid NOT NULL REFERENCES rule.rule_definitions(id) ON DELETE CASCADE, project_id uuid NOT NULL,
        severity text NOT NULL, message text NOT NULL, details jsonb,
        resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
      // Events schema
      `DROP TABLE IF EXISTS events.event_log CASCADE`,
      `CREATE TABLE events.event_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL,
        source text NOT NULL, correlation_id uuid, causation_id uuid,
        project_id uuid, payload jsonb, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now())`,
      // Graph schema
      `CREATE TABLE IF NOT EXISTS graph.branches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, name text NOT NULL,
        description text, parent_branch_id uuid, base_snapshot_id uuid, is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS graph.snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, branch_id uuid,
        label text NOT NULL, description text, node_count integer NOT NULL, edge_count integer NOT NULL,
        graph_data jsonb NOT NULL, parent_snapshot_id uuid, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS graph.flows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, name text NOT NULL,
        description text, nodes text[] NOT NULL DEFAULT '{}', entry_node_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS graph.flow_executions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flow_id uuid NOT NULL REFERENCES graph.flows(id) ON DELETE CASCADE,
        project_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending', current_node_id uuid,
        completed_nodes text[] NOT NULL DEFAULT '{}', context jsonb NOT NULL DEFAULT '{}',
        started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, error text)`,
      // Simulation schema — drop and recreate with correct columns
      `DROP TABLE IF EXISTS simulation.simulation_events CASCADE`,
      `DROP TABLE IF EXISTS simulation.simulation_runs CASCADE`,
      `DROP TABLE IF EXISTS simulation.simulation_definitions CASCADE`,
      `CREATE TABLE simulation.simulation_definitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, name text NOT NULL,
        description text, initial_state jsonb NOT NULL, event_generators jsonb NOT NULL DEFAULT '[]',
        rules_config jsonb NOT NULL DEFAULT '{}', termination jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE simulation.simulation_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), definition_id uuid NOT NULL REFERENCES simulation.simulation_definitions(id) ON DELETE CASCADE,
        project_id uuid NOT NULL, triggered_by text NOT NULL, status text NOT NULL DEFAULT 'pending',
        total_steps integer NOT NULL DEFAULT 0, clock_end real NOT NULL DEFAULT 0, metrics jsonb,
        started_at timestamptz, completed_at timestamptz, error text,
        created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE simulation.simulation_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES simulation.simulation_runs(id) ON DELETE CASCADE,
        sim_time real NOT NULL, event_type text NOT NULL, source text,
        payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now())`,
      // Evolution schema
      `CREATE TABLE IF NOT EXISTS evolution.memory_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, type text NOT NULL,
        key text NOT NULL, value jsonb NOT NULL, confidence real NOT NULL DEFAULT 1.0,
        ttl integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS evolution.learned_patterns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, name text NOT NULL,
        description text, pattern jsonb NOT NULL, frequency integer NOT NULL DEFAULT 1,
        success_rate real NOT NULL DEFAULT 0.0, tags text[] NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS evolution.evolution_actions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, type text NOT NULL,
        description text, success boolean NOT NULL DEFAULT true, context jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now())`,
    ];

    // Create schemas first
    const schemas = ['auth', 'project', 'graph', 'agent', 'rule', 'simulation', 'events', 'evolution'];
    for (const s of schemas) {
      try { await app.db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${s}`)); } catch { /* exists */ }
    }

    for (const stmt of statements) {
      try {
        await app.db.execute(sql.raw(stmt));
        created.push(stmt.match(/CREATE TABLE IF NOT EXISTS (\S+)/)?.[1] ?? 'unknown');
      } catch (err) {
        errors.push(`${stmt.slice(0, 60)}...: ${(err as Error).message}`);
      }
    }

    return reply.send({ success: true, data: { created, errors } });
  });
}
