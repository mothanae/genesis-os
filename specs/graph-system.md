# Genesis OS — Graph System Specification

## Overview

The graph is the source of truth in Genesis OS. All software systems are represented as typed, versioned, observable nodes connected by semantic edges. Generated code is only a compiled artifact — the graph topology is the authoritative representation.

## Core Principle

> The graph IS the operating system. Nodes are the components. Edges are the relationships. The runtime is the nervous system. AI is the interpreter. You are the creator.

## Node Taxonomy (60+ types)

### Application
`service` | `function` | `container` | `pod`

### Data
`database` | `cache` | `queue` | `event_store` | `object_store`

### Network
`load_balancer` | `cdn` | `dns` | `api_gateway` | `proxy` | `firewall`

### Integration
`rest_endpoint` | `graphql_schema` | `grpc_service` | `event_topic` | `event_subscription` | `webhook`

### Infrastructure
`environment` | `region` | `cluster` | `namespace`

### AI & Agents
`agent` | `tool` | `prompt_template` | `vector_store`

### UI
`page` | `component` | `form` | `table` | `chart`

### Flow
`flow` | `decision` | `parallel` | `wait` | `subprocess` | `human_task`

## Node Anatomy

Every node has:
- **Identity**: id, type, name, description
- **Position**: x, y coordinates on the visual canvas
- **Ports**: typed input and output contracts
- **Runtime config**: replicas, memory, CPU, scaling, health checks
- **Deployment config**: provider, region, resources, strategy
- **Versioning**: version number, parent ID, branch ID
- **State**: draft → active → deprecated → error

## Edge Types (20+)

- `depends_on` — Runtime dependency
- `communicates_with` — Inter-service communication
- `writes_to` / `reads_from` — Data access
- `produces_to` / `consumes_from` — Queue operations
- `emits` / `subscribes_to` — Event-driven
- `routes_to` / `proxies_to` — API routing
- `deployed_to` / `contains` — Infrastructure
- `replicates_to` — Data replication
- `triggers` — Function invocation

## Semantic Connection Inference

When edges are drawn between node types, the system infers implied subsystems:

| Connection | Inferred Systems |
|------------|-----------------|
| Service → Service | Messaging, presence, notifications, service mesh, distributed tracing |
| Service → Database | Data access layer, query cache, read replica |
| Service → Queue | Worker pool, dead letter queue |
| API Gateway → Service | Rate limiter, auth service |
| Service → Event Topic | Event bus, schema registry |
| Service → Cache | Cache invalidation events |

## Graph Validation (10 rules)

1. **Cycle detection** — ERROR: circular dependencies
2. **Orphaned nodes** — WARNING: nodes with no connections
3. **Missing references** — ERROR: edges pointing to nonexistent nodes
4. **Invalid connections** — WARNING: unsupported node-type/edge-type combinations
5. **Unused databases** — WARNING: database with no consuming services
6. **Missing output ports** — WARNING: services without output port definitions
7. **High fan-out** — WARNING: >10 outgoing edges from one node
8. **Missing runtime config** — SUGGESTION: services without runtime configuration
9. **Self-referencing edges** — ERROR: node connected to itself
10. **Duplicate edges** — WARNING: identical source:target:type edges

## Graph Operations

### Mutations
- `createNode` / `updateNode` / `deleteNode` — Node lifecycle
- `createEdge` / `updateEdge` / `deleteEdge` — Edge lifecycle with bidirectional support
- `createBranch` / `listBranches` / `mergeBranch` — Branching with snapshot base

### Queries
- `listNodes` — Paginated with type/state/branch filters
- `listEdges` — Filtered by type or node
- `searchNodes` — ILIKE search across name/description
- `bfs` / `dfs` — Breadth-first and depth-first traversal
- `shortestPath` — Recursive CTE shortest path
- `ancestors` / `descendants` — Upstream/downstream dependency traversal

### Analysis
- `detectCycles` — Recursive CTE cycle detection
- `impactAnalysis` — What breaks if this node changes
- `validateTopology` — Full 10-rule validation + semantic inference

### Snapshots & Versioning
- `createSnapshot` / `listSnapshots` / `getSnapshot`
- `diffSnapshots` / `restoreSnapshot`
- Version history with rollback and comparison

## Diagram Generation

Four output formats from graph topology:
- **Mermaid** — Subgraphs, custom shapes, color classes, animated edges
- **Graphviz** — DOT format with proper arrow types
- **D2** — Modern diagram language with rich styling
- **PlantUML** — Enterprise architecture diagrams

## Database Schema

```
graph.nodes     — position_x REAL, position_y REAL, inputs JSONB, outputs JSONB, runtime JSONB, deployment JSONB
graph.edges     — weight REAL, properties JSONB, version INTEGER
graph.branches  — branch management
graph.snapshots — graph_data JSONB snapshot storage
graph.flows     — flow orchestration
graph.flow_executions — flow execution state
```
