# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Genesis OS — A visual AI-powered software creation operating system. The graph is the source of truth. Code is only a compiled artifact.

## Common Commands

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | Build all 14 packages + apps (Turborepo) |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm --filter @genesis-1/api dev` | Start just the API (Fastify, port 3001, requires Postgres+Redis) |
| `pnpm --filter @genesis-1/next dev` | Start just the frontend (Next.js, port 3000) |
| `NEXT_PUBLIC_MOCK=true pnpm --filter @genesis-1/next dev` | Frontend with MSW mock data (no backend needed) |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm test` | Run all Vitest tests (requires env vars below) |
| `pnpm --filter @genesis-1/next test:e2e` | Run Playwright E2E tests (chromium, auto-starts dev server) |
| `pnpm --filter @genesis-1/database db:seed` | Seed demo data (user, project, graph, rules, agent) |
| `pnpm format:check` | Prettier format check (CI uses this) |
| `npx vitest run path/to/test.test.ts` | Run a single test file |
| `pnpm clean` | Remove all dist/.next/coverage |

**Running tests requires these env vars** (the `@genesis-1/config` package validates env at import time):
```
$env:DATABASE_URL="postgres://test:test@localhost:5432/test"
$env:REDIS_URL="redis://localhost:6379"
$env:JWT_SECRET="test-secret-key-that-is-at-least-32-chars-long!!!!!!"
$env:NODE_ENV="test"
$env:SKIP_ENV_VALIDATION="true"
```

**Starting the API for development** (copy `.env.example` to `.env` first):
```
$env:DATABASE_URL="postgres://genesis1:genesis1_dev@localhost:5432/genesis1"
$env:REDIS_URL="redis://localhost:6379"
$env:JWT_SECRET="dev-secret-change-me-a2b914c08d7f3e6a9b5c1d0e4f7a8b2c"
$env:NODE_ENV="development"
```

**Infrastructure** (PostgreSQL + Redis — required for API):
- PostgreSQL: `winget install PostgreSQL.PostgreSQL.17` (port 5432)
- Redis: `winget install Redis.Redis` (port 6379)
- Or: `docker compose up -d postgres redis` (if Docker Desktop is running)
- `.env` must be created from `.env.example` — the API won't start without it
- Create the database: `CREATE USER genesis1 WITH PASSWORD 'genesis1_dev' CREATEDB; CREATE DATABASE genesis1 OWNER genesis1;`
- Tables must be created via SQL or drizzle-kit before the API can use them

## Architecture Philosophy

- **Graph-first, not prompt-first** — Everything originates from nodes, edges, topology, relationships
- **Event-driven** — All mutations publish events via Redis pub/sub
- **Modular monorepo** — 12 packages + 2 apps (api, next), each independently testable
- **The execution loop**: `USER ACTION → GRAPH MUTATION → INTENT EXTRACTION → RULE VALIDATION → TASK PLANNING → AGENT SELECTION → EXECUTION → VALIDATION → SIMULATION → UI UPDATE`

## Package Dependency Graph

```
apps/next → @genesis-1/shared (only — frontend never imports backend packages)

apps/api → ALL packages (orchestrates the full execution loop)

packages/shared → packages/config
packages/database → shared, config
packages/event-bus → shared, ioredis
packages/graph-engine → shared, database, event-bus
packages/rule-engine → shared, database, event-bus
packages/agent-runtime → shared, database, event-bus, graph-engine, rule-engine, simulation-engine, deployment-engine
packages/simulation-engine → shared, database, event-bus, graph-engine
packages/generation-engine → shared, database, event-bus, graph-engine
packages/deployment-engine → shared, database, event-bus, graph-engine
packages/evolution-engine → shared, database, event-bus, graph-engine, rule-engine
```

All use `workspace:*` protocol in package.json. Packages built with `tsup` (ESM output), apps with `tsup` (API) and Next.js (frontend).

## Package Summary

| Package | Domain | Key Classes |
|---------|--------|------------|
| `@genesis-1/shared` | Types, schemas, utils | `GraphNode`, `GraphEdge`, `Port`, `EventType`, Zod schemas (6 domains) |
| `@genesis-1/config` | Env validation | `env` (Zod-validated by `@t3-oss/env-core`) — **never use `process.env` directly** |
| `@genesis-1/database` | Drizzle ORM + 7 schemas | `createClient`, 18+ tables, `BaseRepository` |
| `@genesis-1/event-bus` | Redis pub/sub + Socket.IO | `EventPublisher`, `EventSubscriber`, `EventLogger`, `SocketIOAdapter` |
| `@genesis-1/graph-engine` | Graph mutation + traversal | `GraphEngine`, `GraphValidator` (10 check categories), `VersionHistory`, `ArchitectureDiagrams` |
| `@genesis-1/rule-engine` | JSON Logic evaluator | `RuleEngine`, `JsonLogicEvaluator` (12 operators: eq/gt/lt/gte/lte/in/not_in/contains/starts_with/ends_with/matches/and/or/not) |
| `@genesis-1/agent-runtime` | Agent orchestration + LLM | `AgentRuntime`, `AgentOrchestrator` (10 agents), `BullMqManager`, `OllamaProvider` |
| `@genesis-1/simulation-engine` | Discrete-event simulator | `SimulationEngine` (6 generators, 5 load profiles, failure injection) |
| `@genesis-1/generation-engine` | Graph→code compiler | `GenerationEngine` (8 target stacks), `FrontendGenerator`, `BackendGenerator`, `DatabaseGenerator`, `InfraGenerator` |
| `@genesis-1/deployment-engine` | Deploy artifact generation | `DeploymentEngine`, `DockerGenerator`, `KubernetesGenerator`, `TerraformGenerator`, `CICDGenerator`, `MonitoringGenerator` |
| `@genesis-1/evolution-engine` | Architecture learning | `EvolutionEngine`, `ArchitectureMemory`, `TemplateRegistry` (5 templates), `SelfHealer` |
| `@genesis-1/plugin-registry` | Plugin system | `PluginRegistry` (8 plugin types, hook system) |

## API Routes (12 modules)

All routes under `apps/api/src/routes/`. Registered in `apps/api/src/routes/index.ts`.

| Module | Prefix | Key Endpoints | Auth Required |
|--------|--------|--------------|---------------|
| Health | `/health` | `GET /health` | No |
| Auth | `/api/v1/auth` | `POST /register`, `POST /login`, `GET /me`, `POST /refresh`, `POST /logout`, `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/:keyId` | /me + /api-keys |
| Projects | `/api/v1/projects` | CRUD + members | Yes (all) |
| Graph | `/api/v1/projects/:id/graph` | Nodes, edges, search, snapshots, cycles, impact, diagrams | No* |
| Agents | `/api/v1/projects/:id/agents` | CRUD, execute, pause/resume/cancel, execution steps | No* |
| Rules | `/api/v1/projects/:id/rules` | Rule sets, evaluation, violations | No* |
| Simulations | `/api/v1/projects/:id/simulations` | CRUD, run, runs list, run events | No* |
| Generation | `/api/v1/projects/:id` | `POST /generate`, `POST /execute-loop` | No* |
| Deployment | `/api/v1/projects/:id/deploy` | `POST /generate`, `POST /simulate`, `POST /rollback` | No* |
| Evolution | `/api/v1/projects/:id` | `POST /evolve`, `GET /insights`, `GET /templates` | No* |
| GraphQL | `/api/v1/graphql` | `POST /graphql` — graphql-yoga with GraphiQL playground, 10 queries + 9 mutations (mutations require auth via JWT or X-API-Key header) | Queries: No, Mutations: Yes |
| WebSocket | `/ws` | Real-time canvas sync, graph mutations, cursor awareness (token+projectId via query params) | Token |

*Starred routes: authentication is available but not enforced by default. Add `preHandler: [authenticate]` to enforce.

## App Wiring (Critical Order)

The API app (`apps/api/src/app.ts`) builds the Fastify server with strict ordering:

1. Fastify created (bodyLimit: 1MB)
2. Plugins registered: cors, websocket, swagger, swagger-ui, rate-limit
3. **Database client created** (lazy, connects on first query)
4. **Redis connected** (with lazyConnect + explicit connect)
5. Event bus: **publisher needs its own Redis connection** (`redis.duplicate()`); subscriber gets a separate duplicate. Sharing a connection causes "Connection in subscriber mode" errors when trying to publish
6. All engines instantiated (GraphEngine, RuleEngine, AgentRuntime, SimulationEngine, AgentOrchestrator, GenerationEngine, DeploymentEngine, EvolutionEngine)
7. **All engines decorated on `app`** — must happen before auth plugin
8. **Auth service decorated** (`app.decorate('authService', new AuthService(db))`) — must be AFTER `app.decorate('db', db)` since AuthService reads `app.db`
9. Routes registered

**Do not reorder these steps.** The auth plugin must come after db decoration, and the Redis pub/sub separation is load-bearing.

## Auth System

### API Side
- `apps/api/src/services/auth.service.ts` — `AuthService` class: bcrypt (12 rounds), JWT HS256, register/login/refresh/me/logout
- `apps/api/src/services/api-key.service.ts` — `ApiKeyService` class: SHA-256 key hashing, `genesis_` prefix, 10-key limit per user, create/list/revoke/verify
- `apps/api/src/plugins/auth.ts` — Fastify hooks: `authenticate` (accepts JWT Bearer OR X-API-Key header), `authenticateApiKey` (standalone), `requireAdmin`, `requireStaff`, `optionalAuth`
- JWT payload shape: `{ sub: userId, email, role, iat, exp }`
- Session management via `auth.sessions` table (refresh tokens, expiry, revocation)
- API keys stored in `auth.api_keys` table (key hashed with SHA-256, raw key shown only once at creation)
- Domain errors: `EmailAlreadyExistsError` (409), `InvalidCredentialsError` (401), `UserBlockedError` (403), `UserNotFoundError` (404), `ApiKeyLimitError` (400), `ApiKeyNotFoundError` (404)

### Frontend Side
- `apps/next/src/stores/auth.store.ts` — Zustand store with `login`, `register`, `logout`, `refresh`, `restoreSession`
- Token stored in `localStorage` as `genesis_token` and `genesis_refresh`
- `apps/next/src/lib/api-client.ts` — `apiClient<T>()` wraps fetch with auto Bearer token, 401→refresh→retry, 30s timeout, ApiClientError
- `apps/next/src/providers/auth-provider.tsx` — calls `restoreSession()` on mount
- Dashboard layout (`(dashboard)/layout.tsx`) redirects to `/login` if not authenticated

## Schema ↔ Engine Field Mapping (Load-Bearing)

The Zod schemas (`createNodeSchema`, `createEdgeSchema`) use different field names than the `GraphEngine` methods. **Routes must map between them:**

| Schema Field | Engine Field |
|-------------|-------------|
| `nodeType` | `type` |
| `label` | `name` |
| `positionX` | `position.x` |
| `positionY` | `position.y` |
| `sourceNodeId` | `source` |
| `targetNodeId` | `target` |
| `edgeType` | `type` |

The `properties` field from schemas goes into `metadata` (engine doesn't accept `properties` directly). See `graph.routes.ts` for the working mapping pattern.

## Database Tables (Critical DDL)

The GraphEngine expects specific column names. Tables must be created with these columns:

- `graph.nodes`: `position_x REAL`, `position_y REAL` (not a JSONB `position` column), `inputs JSONB`, `outputs JSONB`, `runtime JSONB`, `deployment JSONB`, `version INTEGER`, `parent_id UUID`, `branch_id UUID`
- `graph.edges`: `weight REAL`, `properties JSONB`, `version INTEGER`, `updated_at TIMESTAMPTZ`
- `auth.users`: `password_hash TEXT` (not `passwordHash`), `display_name TEXT`
- `auth.sessions`: `user_id UUID` REFERENCES, `refresh_token TEXT UNIQUE`, `expires_at TIMESTAMPTZ`, `revoked_at TIMESTAMPTZ`

The `drizzle-kit push` command has a version mismatch (drizzle-orm 0.33 vs drizzle-kit 0.27). Create tables via SQL or fix the version alignment.

## Three-Tier Policy

| Layer | Policy | Mechanism |
|-------|--------|-----------|
| **Auth** | FAIL-CLOSED | Deny on uncertainty |
| **Rate Limiting** | FAIL-OPEN | Allow on Redis error to prevent site downtime |
| **Cache** | FAIL-OPEN | Return `null` on Redis error, recompute or serve stale |

## Key Conventions

- **Graph is source of truth** — All mutations flow through `GraphEngine`. Events published on every mutation.
- **Domain errors over raw strings** — Throw typed errors with `statusCode` property. The `handleApiError` catches these.
- **Zod for all validation** — Shared schemas in `@genesis-1/shared` are the single source of truth.
- **`@genesis-1/config` env** — The `env` object is the **only** way to access env vars. Never use `process.env` directly in application code.
- **Repository pattern (partial)** — Some routes use repositories, others use raw drizzle queries. The `BaseRepository` class exists but is not universally adopted.
- **`pnpm` + `workspace:*`** — All internal dependencies use workspace protocol.
- **Turborepo pipeline** — `build` depends on `^build` (upstream). `dev` is persistent + cache: false.
- **Event naming** — Events use `genesis-1.{domain}.{entity}.{action}` pattern.
- **`tsup` for packages, `tsx watch` for API dev** — ESM output, declaration files, clean builds. API uses `tsx watch` for hot reload.

## Execution Loop

The full pipeline at `POST /api/v1/projects/:id/execute-loop`:

1. `GraphEngine.validateTopology()` — cycle detection, orphan detection, port validation
2. `AgentOrchestrator.planFromGraph()` — categorize nodes, create task DAG
3. `AgentOrchestrator.executePlan()` — run tasks with specialist agents
4. `GenerationEngine.generate()` — compile graph into code for target stack
5. `DeploymentEngine.generateDeployment()` — produce Docker/K8s/Terraform/CI-CD artifacts
6. `EvolutionEngine.evolve()` — analyze, find insights, self-heal, match templates
7. All results broadcast via WebSocket to connected clients

## Visual Canvas

- **React Flow** for the graph canvas with custom node types
- **Zustand** for canvas state (`canvas.store.ts` — nodes, edges, undo/redo stack)
- **Drag-and-drop** from `NodePalette` onto the canvas
- **WebSocket** for real-time multi-user sync — `graph_mutation` events broadcast to project room. Cross-instance broadcast via Redis `genesis-1.ws.broadcast:*` channels with instance dedup (`INSTANCE_ID`). Per-user connection limit (max 5, Redis INCR/DECR with 60s TTL, fail-open).
- **NodeInspector** panel for editing selected node properties
- **Monaco Editor** for viewing generated code
- **Playwright** for E2E tests (chromium, 10 tests across smoke/auth/dashboard specs, `test:e2e` script)

## Known Issues

- `drizzle-kit push/generate` fails: version mismatch — `drizzle-orm` (0.33) is incompatible with available `drizzle-kit` versions. Currently on 0.28.1. Use `/health/migrate` endpoint or raw SQL for schema changes. Both packages need a coordinated upgrade.
- `GraphEngine.detectCycles()` uses raw `db.execute()` which may fail depending on drizzle-orm version. The cycle detection recursive CTE is fragile.
- Two PostgreSQL instances (17 and 18) may conflict on port 5432. Use `Get-NetTCPConnection -LocalPort 5432` to check which version owns the port.
- The `tsx watch` restart can leave the old process holding the port (EADDRINUSE). Kill old node processes before restarting if needed.
- `apps/api/src/plugins/auth.ts:authPlugin` is dead code — `app.ts` already decorates `authService` and `apiKeyService` directly. The plugin function is exported but never registered.
