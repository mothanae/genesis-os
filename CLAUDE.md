# CLAUDE.md

Genesis OS — A visual AI-powered software creation operating system. The graph is the source of truth. Code is only a compiled artifact.

## Architecture Philosophy

- **Graph-first, not prompt-first** — Everything originates from nodes, edges, topology, relationships, flows, constraints
- **Event-driven** — 56 event types spanning auth, graph, agents, rules, simulation, generation, deployment, evolution
- **Modular monorepo** — 11 packages + 2 apps, each independently testable with exposed contracts
- **The execution loop**: `USER ACTION → GRAPH MUTATION → INTENT EXTRACTION → RULE VALIDATION → TASK PLANNING → AGENT SELECTION → EXECUTION → VALIDATION → SIMULATION → UI UPDATE`

## Common Commands

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start all apps in dev mode (Turborepo) |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | TypeScript type checking across all packages |
| `pnpm test` | Run all Vitest tests |
| `pnpm clean` | Remove all dist/.next/coverage |
| `docker compose up -d postgres redis` | Start infrastructure services |
| `docker compose --profile all up` | Start all services in development |
| `docker compose -f docker-compose.prod.yml --profile all up` | Production stack |

## Package Dependency Graph

```
apps/next → @genesis-1/shared (only — frontend never imports backend directly)

apps/api → ALL packages (orchestrates the full execution loop)

packages/shared → packages/config
packages/database → shared, config
packages/event-bus → shared, ioredis
packages/graph-engine → shared, database, event-bus
packages/rule-engine → shared, database, event-bus
packages/agent-runtime → shared, database, event-bus, graph-engine, rule-engine
packages/simulation-engine → shared, database, event-bus, graph-engine, rule-engine
packages/generation-engine → shared, database, event-bus, graph-engine
packages/deployment-engine → shared, database, event-bus, graph-engine
packages/evolution-engine → shared, database, event-bus, graph-engine, rule-engine
```

All use `workspace:*` protocol in package.json.

## Package Summary

| Package | Domain | Key Classes |
|---------|--------|------------|
| `@genesis-1/shared` | Types, schemas, utils | `GraphNode`, `GraphEdge`, `Port`, `EventType` (56 members), Zod schemas (6 domains) |
| `@genesis-1/config` | Env validation | `env` (Zod-validated by `@t3-oss/env-core`) |
| `@genesis-1/database` | Drizzle ORM + 7 schemas | `createClient`, 18+ tables, `BaseRepository` |
| `@genesis-1/event-bus` | Redis pub/sub + Socket.IO | `EventPublisher`, `EventSubscriber`, `EventLogger`, `SocketIOAdapter` |
| `@genesis-1/graph-engine` | Graph mutation + traversal | `GraphEngine`, `GraphValidator` (10 check categories) |
| `@genesis-1/rule-engine` | JSON Logic evaluator | `RuleEngine`, `JsonLogicEvaluator` (20+ operators), 12 preset rules |
| `@genesis-1/agent-runtime` | LangGraph agents + workers | `AgentRuntime`, `AgentOrchestrator` (10 agents), `BullMqManager`, `OllamaProvider` |
| `@genesis-1/simulation-engine` | Discrete-event simulator | `SimulationEngine` (6 generators, 5 load profiles, failure injection) |
| `@genesis-1/generation-engine` | Graph→code compiler | `GenerationEngine` (8 target stacks: React, Next.js, Node.js, FastAPI, Laravel, Django, Golang, Rust) |
| `@genesis-1/deployment-engine` | Deploy artifact generation | `DeploymentEngine`, `DockerGenerator`, `KubernetesGenerator`, `TerraformGenerator`, `CICDGenerator`, `MonitoringGenerator` |
| `@genesis-1/evolution-engine` | Architecture learning | `EvolutionEngine`, `ArchitectureMemory`, `TemplateRegistry` (5 templates), `SelfHealer` |

## API Routes (10 modules)

| Module | Prefix | Key Endpoints |
|--------|--------|--------------|
| Health | `/health` | `GET /health` |
| Auth | `/api/v1/auth` | `POST /register`, `POST /login`, `GET /me` |
| Projects | `/api/v1/projects` | CRUD + members |
| Graph | `/api/v1/projects/:id/graph` | Nodes, edges, traversal, snapshots, cycle detection, impact analysis |
| Agents | `/api/v1/projects/:id/agents` | CRUD, execute, pause/resume/cancel, execution steps |
| Rules | `/api/v1/projects/:id/rules` | Rule sets, CRUD, evaluation, violations |
| Simulations | `/api/v1/projects/:id/simulations` | CRUD, run, events, trace |
| Generation | `/api/v1/projects/:id` | `POST /generate`, `POST /execute-loop` (full pipeline) |
| Deployment | `/api/v1/projects/:id/deploy` | `POST /generate`, `POST /simulate`, `POST /rollback` |
| Evolution | `/api/v1/projects/:id` | `POST /evolve`, `GET /insights`, `GET /templates` |
| GraphQL | `/api/v1/graphql` | `POST /graphql` (query projects, graphNodes, graphEdges, agents, executions, violations, topologyValidation) |
| WebSocket | `/ws?token=...&projectId=...` | Real-time canvas sync, graph mutations, cursor awareness |

## Database Schemas

| Schema | Owner | Key Tables |
|--------|-------|------------|
| `auth` | api | users, sessions, api_keys |
| `project` | api | projects, project_members |
| `graph` | graph-engine | nodes (with ports/runtime/deployment JSONB), edges (realtime/bidirectional), branches, snapshots, flows, flow_executions |
| `agent` | agent-runtime | agent_definitions, executions, execution_steps |
| `rule` | rule-engine | rule_definitions, rule_sets, evaluation_results, violations |
| `simulation` | simulation-engine | simulation_definitions, simulation_runs, simulation_events |
| `events` | event-bus | event_log |

## Three-Tier Policy

| Layer | Policy | Mechanism |
|-------|--------|-----------|
| **Auth** | FAIL-CLOSED | `user?.isBlocked ?? true` — deny on uncertainty |
| **Rate Limiting** | FAIL-OPEN | Allow on Redis error to prevent site downtime |
| **Cache** | FAIL-OPEN | Return `null` on Redis error, recompute or serve stale |

## Key Conventions

- **Graph is source of truth** — All mutations flow through `GraphEngine`. Events are published for every mutation.
- **Domain errors over raw strings** — Use typed error classes. Never `new Error("STRING")`.
- **Zod for all validation** — Shared schemas in `@genesis-1/shared` are the single source of truth.
- **Event catalog** — All events use `genesis-1.{domain}.{entity}.{action}` naming. 56 event types in `EventType` enum.
- **WebSocket scoping** — Clients subscribe to `project:{id}:*` channels. Server filters by project membership.
- **`pnpm` + `workspace:*`** — All internal dependencies use workspace protocol.
- **Turborepo pipeline** — `build` depends on `^build` (upstream). `dev` is persistent + cache: false.
- **Docker development** — Bind-mount source; node_modules are volume-masked for performance.
- **`tsup` for packages** — ESM output, declaration files, clean builds.
- **`tsx` for API dev** — Fastify hot reload via `tsx watch`.

## Execution Loop

The full pipeline is triggered at `POST /api/v1/projects/:id/execute-loop`:

1. `GraphEngine.validateTopology()` — cycle detection, orphan detection, port validation
2. `AgentOrchestrator.planFromGraph()` — categorize nodes, create task DAG
3. `AgentOrchestrator.executePlan()` — run tasks with specialist agents
4. `GenerationEngine.generate()` — compile graph into code for target stack
5. `DeploymentEngine.generateDeployment()` — produce Docker/K8s/Terraform/CI-CD artifacts
6. `EvolutionEngine.evolve()` — analyze, find insights, self-heal, match templates
7. All results broadcast via WebSocket to connected clients

## Visual Canvas Architecture

- **React Flow** for the graph canvas with custom node types (35+ types, 8 categories)
- **Zustand** for canvas state (nodes, edges, undo/redo stack)
- **Drag-and-drop** from `NodePalette` sets `application/genesis-node-type` MIME data
- **WebSocket** for real-time multi-user sync — `graph_mutation` events broadcast to room
- **NodeInspector** panel for editing selected node properties (name, state, runtime config)
- **Monaco Editor** for viewing generated code with syntax highlighting
