# Genesis OS — Package Architecture

## Overview

11 packages and 2 applications in a Turborepo monorepo managed by pnpm workspaces.

## Dependency Graph

```
apps/next
  └── @genesis-1/shared

apps/api
  ├── @genesis-1/shared
  ├── @genesis-1/config
  ├── @genesis-1/database
  ├── @genesis-1/event-bus
  ├── @genesis-1/graph-engine
  ├── @genesis-1/rule-engine
  ├── @genesis-1/agent-runtime
  ├── @genesis-1/simulation-engine
  ├── @genesis-1/generation-engine
  ├── @genesis-1/deployment-engine
  └── @genesis-1/evolution-engine
```

## Package Catalog

### `@genesis-1/shared` — Shared Contracts
**Layer**: Cross-cutting foundation
**Depends on**: `@genesis-1/config`
**Exports**: TypeScript types (7 domains: auth, project, graph, agent, rule, simulation, event), Zod schemas (6 modules), constants (56 event channels, WebSocket scopes), utilities (ID generation, slug creation, retry with backoff), `EventType` enum (56 members), `ApiClientError` class

### `@genesis-1/config` — Environment Configuration
**Layer**: Foundation
**Exports**: `env` — Zod-validated environment object using `@t3-oss/env-core`. Validates: NODE_ENV, LOG_LEVEL, DATABASE_URL, REDIS_URL, JWT_SECRET, API_PORT, CORS_ORIGIN, optional API keys.

### `@genesis-1/database` — Data Access Layer
**Layer**: Foundation
**Depends on**: `@genesis-1/shared`, `@genesis-1/config`
**Exports**: `createClient()` factory for Drizzle ORM with PostgreSQL, 8 schema domains (auth, project, graph, agent, rule, simulation, events, evolution), 25 tables, `BaseRepository` generic CRUD template
**Key Tables**: users, sessions, api_keys, projects, project_members, nodes (with ports/runtime/deployment JSONB), edges (realtime/bidirectional), branches, snapshots, flows, flow_executions, agent_definitions, executions, execution_steps, rule_definitions, rule_sets, evaluation_results, violations, simulation_definitions, simulation_runs, simulation_events, event_log, memory_records, learned_patterns, evolution_actions

### `@genesis-1/event-bus` — Event System
**Layer**: Communication infrastructure
**Depends on**: `@genesis-1/shared`, ioredis
**Exports**: `EventPublisher` (publish to Redis channels), `EventSubscriber` (subscribe with handler pattern), `EventLogger` (persist events to event_log table), `SocketIOAdapter` (bridge Redis events to Socket.IO rooms)

### `@genesis-1/graph-engine` — Graph Engine
**Layer**: Core domain
**Depends on**: `@genesis-1/shared`, `@genesis-1/database`, `@genesis-1/event-bus`
**Exports**: `GraphEngine` (full CRUD, BFS/DFS traversal, shortest path via recursive CTE, cycle detection, impact analysis with cascading failures, branching with merge, snapshots with diff/restore, flow execution), `GraphValidator` (10 validation categories: cycles, orphans, missing refs, invalid connections, unused databases, no output ports, high fan-out, missing runtime config, self-references, duplicate edges), `ArchitectureDiagrams` (4 formats: Mermaid, Graphviz DOT, D2, PlantUML)

### `@genesis-1/rule-engine` — Rule Engine
**Layer**: Validation & Intelligence
**Depends on**: `@genesis-1/shared`, `@genesis-1/database`, `@genesis-1/event-bus`
**Exports**: `RuleEngine` (sync/async/reactive evaluation modes), `JsonLogicEvaluator` (20+ operators: eq, not_equal, gt, lt, gte, lte, in, not_in, contains, starts_with, ends_with, matches, and, or, not, all, any, none, exists, path_exists), 3 preset rule sets (Graph Architecture: 6 rules, Security Validator: 3 rules, Scalability Validator: 3 rules)

### `@genesis-1/agent-runtime` — Agent Runtime
**Layer**: AI Orchestration
**Depends on**: `@genesis-1/shared`, `@genesis-1/database`, `@genesis-1/event-bus`, `@genesis-1/graph-engine`, `@genesis-1/rule-engine`
**Exports**: `AgentRuntime` (execution lifecycle: pending→initializing→running→completed/failed/cancelled, with pause/resume support), `AgentGraphCompiler` (LangGraph JSON→compiled graph), `AgentOrchestrator` (10 specialist agents: planner, frontend, backend, API, database, infra, validate, simulate, deploy, document; DAG task execution with dependency resolution), `BullMqManager` (Redis-backed job queues with retry/backoff), `OllamaProvider` (local LLM support with tool calling)

### `@genesis-1/simulation-engine` — Runtime Simulation
**Layer**: Runtime Analysis
**Depends on**: `@genesis-1/shared`, `@genesis-1/database`, `@genesis-1/event-bus`
**Exports**: `SimulationEngine` (discrete-event simulation, 6 generators: HTTP traffic, DB queries, pub/sub events, auth flows, background jobs, WebSocket; 5 load profiles: constant, ramp, spike, sinusoidal, real-world; failure injection: crash, latency spike, network partition, OOM, disk full; auto-scaling; P50/P95/P99 metrics)

### `@genesis-1/generation-engine` — Code Generation
**Layer**: Compilation
**Depends on**: `@genesis-1/shared`, `@genesis-1/database`, `@genesis-1/event-bus`, `@genesis-1/graph-engine`
**Exports**: `GenerationEngine` (graph→code compiler, 8 target stacks: React, Next.js, Node.js, FastAPI, Laravel, Django, Golang, Rust; per-node generation: service→backend service + test, database→schema, api_gateway→routes, rest_endpoint→endpoint, graphql_schema→.graphql, page→Next.js page, component→React component, container→Dockerfile; complete project outputs: observability configs, scalability docs, architecture docs, analytics setup, .env)

### `@genesis-1/deployment-engine` — Deployment Engine
**Layer**: Infrastructure
**Depends on**: `@genesis-1/shared`, `@genesis-1/database`, `@genesis-1/event-bus`, `@genesis-1/graph-engine`
**Exports**: `DeploymentEngine` (generates complete deployment artifacts), `DockerGenerator` (per-service Dockerfiles + docker-compose with healthchecks, resource limits), `KubernetesGenerator` (Deployment, Service, ConfigMap, HPA, Ingress, Namespace, Kustomization), `TerraformGenerator` (AWS/GCP/Azure providers, ECS Fargate, RDS, VPC modules), `CICDGenerator` (GitHub Actions with test→build→deploy→rollback stages + Dependabot), `MonitoringGenerator` (Prometheus config, 6 alert rules, Grafana dashboard JSON, datasource config)

### `@genesis-1/evolution-engine` — Evolution Engine
**Layer**: Architecture Intelligence
**Depends on**: `@genesis-1/shared`, `@genesis-1/database`, `@genesis-1/event-bus`, `@genesis-1/graph-engine`, `@genesis-1/rule-engine`
**Exports**: `EvolutionEngine` (7 insight categories: monolith detection, missing cache, no observability, high fan-in, no health check, no API gateway, over-provisioning), `ArchitectureMemory` (persistent pattern learning with `PersistenceProvider` interface), `TemplateRegistry` (5 built-in templates: Standard Web App, Microservices, Event-Driven, Serverless, AI Agent Pipeline), `SelfHealer` (auto-fix: connect orphans, add health checks, add output ports)

## Service Boundaries

Each package:
- **Owns its domain** — no cross-package business logic without explicit contracts
- **Exposes typed contracts** — all public APIs are fully typed with TypeScript
- **Publishes events** — all significant state changes are published via `EventBus`
- **Is independently testable** — each package has its own Vitest config
- **Builds to ESM** — all packages use `tsup` with ESM format + declaration files
