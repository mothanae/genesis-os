# Genesis OS — Setup Guide

A visual AI-powered software creation operating system. Graph-first, not prompt-first.

## Prerequisites

- **Node.js** >= 20.18.0
- **pnpm** >= 9.15.0 (`npm install -g pnpm`)
- **Docker** >= 24 (for PostgreSQL + Redis)
- **Git** (optional, for version control)

## Getting Started

```bash
# 1. Clone the repository
git clone <repo-url> genesis-os
cd genesis-os

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your settings (see configuration below)

# 4. Start infrastructure
docker compose up -d postgres redis

# 5. Push database schema
pnpm db:push

# 6. Seed demo data (optional)
pnpm db:seed

# 7. Start development servers
pnpm dev
```

The API runs at `http://localhost:3001` and the frontend at `http://localhost:3000`.

## Configuration

Key environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://genesis1:genesis1_dev@localhost:5432/genesis1` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `JWT_SECRET` | (32+ chars required) | HS256 signing secret |
| `API_PORT` | `3001` | API server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `LOG_LEVEL` | `debug` | Pino log level |
| `OPENAI_API_KEY` | (optional) | OpenAI API key for agents |
| `ANTHROPIC_API_KEY` | (optional) | Anthropic API key for agents |

## Development

```bash
# Run all apps in dev mode
pnpm dev

# Run only the API
pnpm --filter @genesis-1/api dev

# Run only the frontend
pnpm --filter @genesis-1/next dev

# Run a single package tests
pnpm --filter @genesis-1/graph-engine test

# Type check all packages
pnpm typecheck

# Build everything
pnpm build

# Open database studio
pnpm db:studio

# Format code
pnpm format

# Lint
pnpm lint
```

## Package Architecture

```
genesis-os/
├── apps/
│   ├── api/          Fastify 5 backend — 10 route modules, WebSocket, GraphQL
│   └── next/         Next.js 15 frontend — visual canvas, builder, dashboard
├── packages/
│   ├── shared/       Types (7 domains), Zod schemas, 56 event types
│   ├── config/       Environment validation
│   ├── database/     Drizzle ORM — 7 Postgres schemas
│   ├── event-bus/    Redis pub/sub + Socket.IO adapter
│   ├── graph-engine/ Graph mutation, traversal, validation, diagrams
│   ├── rule-engine/  JSON Logic evaluator, architecture presets
│   ├── agent-runtime/ LangGraph agents, orchestrator, BullMQ, Ollama
│   ├── simulation-engine/ Discrete-event simulator
│   ├── generation-engine/ Graph→code compiler (8 stacks)
│   ├── deployment-engine/ Docker/K8s/Terraform/CI-CD generators
│   └── evolution-engine/ Architecture memory, insights, self-healing
└── docker/            Dockerfiles for dev and production
```

## API Documentation

Once the API is running, the Swagger UI is available at:

```
http://localhost:3001/docs
```

## Docker

```bash
# Development (all services)
docker compose --profile all up

# Production
docker compose -f docker-compose.prod.yml --profile all up

# Infrastructure only
docker compose up -d postgres redis
```

## Testing

```bash
# All unit/integration tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
pnpm test:coverage

# E2E tests (requires dev server running)
pnpm test:e2e
```

## CI/CD

GitHub Actions workflows:
- `.github/workflows/ci.yml` — lint, typecheck, test, build on push/PR to main
- `.github/workflows/deploy.yml` — manual deploy to staging/production

## GraphQL

```
POST http://localhost:3001/api/v1/graphql

Query examples:
{ projects { id name slug } }
{ graphNodes(projectId: "uuid") { id type name position { x y } } }
{ violations(projectId: "uuid") { id severity message } }
{ topologyValidation(projectId: "uuid") { valid errors { message } } }
```

## WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001/ws?token=<jwt>&projectId=<uuid>');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // Handle graph mutations, agent progress, simulation events, etc.
};

// Send graph mutations
ws.send(JSON.stringify({ type: 'graph_mutation', payload: { action: 'add_node', node } }));
```

## Architecture

The execution loop: `USER ACTION → GRAPH MUTATION → RULE VALIDATION → TASK PLANNING → AGENT SELECTION → EXECUTION → VALIDATION → SIMULATION → UI UPDATE`

All triggered via `POST /api/v1/projects/:id/execute-loop`.
