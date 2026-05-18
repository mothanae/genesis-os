CREATE SCHEMA IF NOT EXISTS graph;

CREATE TABLE IF NOT EXISTS graph.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  subtype TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
  inputs JSONB NOT NULL DEFAULT '[]',
  outputs JSONB NOT NULL DEFAULT '[]',
  dependencies TEXT[] NOT NULL DEFAULT '{}',
  relationships TEXT[] NOT NULL DEFAULT '{}',
  runtime JSONB,
  deployment JSONB,
  state TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS graph.edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  source UUID NOT NULL REFERENCES graph.nodes(id) ON DELETE CASCADE,
  target UUID NOT NULL REFERENCES graph.nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT,
  realtime BOOLEAN NOT NULL DEFAULT false,
  bidirectional BOOLEAN NOT NULL DEFAULT false,
  weight REAL NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
