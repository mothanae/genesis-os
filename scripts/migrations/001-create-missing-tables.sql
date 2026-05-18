-- Genesis-1 Migration: Create missing tables
-- Run via: psql -U genesis1 -d genesis1 -f scripts/migrations/001-create-missing-tables.sql

-- ═══ Graph Schema ═══

CREATE SCHEMA IF NOT EXISTS graph;
CREATE SCHEMA IF NOT EXISTS simulation;
CREATE SCHEMA IF NOT EXISTS evolution;

-- Graph — Branches
CREATE TABLE IF NOT EXISTS graph.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  parent_branch_id uuid,
  base_snapshot_id uuid,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Graph — Snapshots
CREATE TABLE IF NOT EXISTS graph.snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  branch_id uuid,
  label text NOT NULL,
  description text,
  node_count integer NOT NULL,
  edge_count integer NOT NULL,
  graph_data jsonb NOT NULL,
  parent_snapshot_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Graph — Flows
CREATE TABLE IF NOT EXISTS graph.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  nodes text[] NOT NULL DEFAULT '{}',
  entry_node_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Graph — Flow Executions
CREATE TABLE IF NOT EXISTS graph.flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES graph.flows(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  current_node_id uuid,
  completed_nodes text[] NOT NULL DEFAULT '{}',
  context jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text
);

-- ═══ Simulation Schema ═══

CREATE TABLE IF NOT EXISTS simulation.simulation_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  initial_state jsonb NOT NULL DEFAULT '{}',
  event_generators jsonb NOT NULL DEFAULT '[]',
  rules_config jsonb NOT NULL DEFAULT '{}',
  termination jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulation.simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES simulation.simulation_definitions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  triggered_by uuid,
  status text NOT NULL DEFAULT 'pending',
  total_ticks integer,
  clock_end integer,
  metrics jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulation.simulation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.simulation_runs(id) ON DELETE CASCADE,
  sim_time integer NOT NULL,
  event_type text NOT NULL,
  source text NOT NULL,
  target text,
  payload jsonb NOT NULL DEFAULT '{}',
  duration integer,
  success boolean NOT NULL DEFAULT true
);

-- ═══ Evolution Schema ═══

CREATE TABLE IF NOT EXISTS evolution.memory_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  type text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  confidence real NOT NULL DEFAULT 1.0,
  ttl integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evolution.learned_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  name text NOT NULL,
  description text,
  pattern jsonb NOT NULL,
  frequency integer NOT NULL DEFAULT 1,
  success_rate real NOT NULL DEFAULT 0.0,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evolution.evolution_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  type text NOT NULL,
  description text,
  success boolean NOT NULL DEFAULT true,
  context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
