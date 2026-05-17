# Genesis OS — Agent Orchestration System Specification

## Overview

A multi-agent orchestration runtime that plans, executes, and coordinates AI-powered software generation. Agents operate independently, communicate through graph state, expose reasoning, and remain modular.

## The 10 Agents

| Agent | Type | Role |
|-------|------|------|
| **Planner** | `plan` | Analyzes graph topology, estimates complexity, creates task DAG |
| **Frontend Generator** | `generate_frontend` | Generates React/Next.js components, pages, forms, routing |
| **Backend Generator** | `generate_backend` | Generates Node.js/Fastify services, middleware, dependencies |
| **API Generator** | `generate_api` | Generates REST/GraphQL/gRPC endpoints, OpenAPI specs |
| **Database Generator** | `generate_database` | Generates Drizzle/Prisma/TypeORM schemas and migrations |
| **Infrastructure Generator** | `generate_infra` | Generates Docker, K8s, Terraform, CI/CD configs |
| **Validator** | `validate` | Validates against graph topology and rule violations |
| **Simulator** | `simulate` | Generates simulation configs from graph analysis |
| **Deployer** | `deploy` | Plans deployment strategy, regions, rollback config |
| **Documenter** | `document` | Generates architecture docs, API docs, runbooks |

## Execution Loop

```
USER ACTION → GRAPH MUTATION → EVENT EMISSION → RULE VALIDATION →
TASK PLANNING → AGENT SELECTION → EXECUTION → GENERATION →
SIMULATION → VALIDATION → UI UPDATE → STATE PERSISTENCE
```

## Planning (planFromGraph)

1. List all nodes and edges from the graph
2. Validate topology (cycles, orphans, ports)
3. Categorize nodes into: databases, backend services, API nodes, frontend nodes, infrastructure nodes
4. Create task DAG with dependency ordering:
   - Plan task (always first)
   - Database generation (depends on plan)
   - Backend + API + Frontend (parallel, depend on plan)
   - Infrastructure (depends on backend)
   - Validation (depends on all generation tasks)
   - Documentation (parallel to validation)

## Task State Machine

```
pending → ready → running → completed
                           → failed → retry → pending
                                    → exhausted → failed
```

## Concurrency

- Configurable `maxConcurrentTasks` (default: 3)
- Tasks execute in dependency order
- Deadlock detection: if all remaining tasks are blocked by failed dependencies, cancel them

## LLM Integration

Three provider tiers with automatic selection:

| Provider | Model Examples | When Used |
|----------|---------------|-----------|
| **Anthropic** | claude-sonnet-4-6, claude-opus-4-7 | Complex reasoning, documentation |
| **OpenAI** | gpt-4o-mini, gpt-4o | Code generation, analysis |
| **Ollama** | llama3.2, mistral | Local development, offline mode |

Provider is optional. When unavailable, agents fall back to deterministic graph analysis.

### LLM-Enhanced Agents

| Agent | LLM Usage |
|-------|-----------|
| **Planner** | Architecture analysis + specific recommendations |
| **Validator** | Fix suggestions for each violation |
| **Documenter** | Full architecture documentation generation |

## Agent Communication

- Agents communicate exclusively through graph state mutations
- No direct inter-agent messaging
- Every mutation publishes an event for observability

## Execution Visibility

- Every task publishes `genesis-1.agent.execution.{started|completed|failed}` events
- Execution steps tracked per agent with timing and token counts
- WebSocket broadcasts real-time progress to connected clients

## Queue System

- `BullMqManager` wraps Redis-backed job queues
- Concurrency control per queue
- Retry with exponential backoff
- Delayed jobs for scheduling
- Queue lifecycle management (pause/resume/drain)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:projectId/agents` | GET/POST | List/create agents |
| `/:projectId/agents/:id` | GET/PATCH/DELETE | Agent CRUD |
| `/:projectId/agents/:id/execute` | POST | Execute agent (async) |
| `/:projectId/agents/:id/executions` | GET | List executions |
| `/:projectId/agents/:id/executions/:eid` | GET | Get execution status |
| `/:projectId/agents/:id/executions/:eid/pause` | POST | Pause execution |
| `/:projectId/agents/:id/executions/:eid/resume` | POST | Resume execution |
| `/:projectId/agents/:id/executions/:eid/cancel` | POST | Cancel execution |
| `/:projectId/agents/:id/executions/:eid/steps` | GET | Get execution steps |

## Execution Loop Endpoint

`POST /api/v1/projects/:id/execute-loop` runs the full pipeline:

1. Topology validation
2. Plan creation
3. Task execution
4. Code generation
5. Deployment artifact generation
6. Architecture evolution (insights, self-healing, templates)

Results are broadcast via WebSocket to all connected clients.
