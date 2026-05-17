# Genesis OS — Event System Specification

## Overview

Genesis OS is fully event-driven. All graph mutations and system operations emit typed, versioned, replayable events through a Redis-backed pub/sub bus. Events are the nervous system of the platform — they connect graph mutations to agent orchestration, simulation, generation, deployment, and evolution.

## Event Naming Convention

```
genesis-1.{domain}.{entity}.{action}
```

Examples:
- `genesis-1.graph.node.created`
- `genesis-1.agent.execution.started`
- `genesis-1.simulation.run.completed`

## Event Domains

| Domain | Description | Key Events |
|--------|-------------|------------|
| `graph` | Graph topology mutations | node.created/updated/deleted, edge.created/updated/deleted, branch.created, snapshot.created |
| `agent` | Agent execution lifecycle | execution.started/paused/resumed/completed/failed, step.completed |
| `simulation` | Simulation runs | run.started/progress/completed/failed |
| `generation` | Code generation | code.generated, project.build |
| `deployment` | Deployment operations | deploy.generated/simulated/rolled-back |
| `evolution` | Architecture evolution | evolution.completed, insight.found, fix.applied |
| `rules` | Rule evaluation | rule.evaluated, violation.created/resolved |

## Event Envelope

Every event follows a standard envelope:

```typescript
interface EventEnvelope {
  id: string;              // Unique event ID (UUID)
  type: EventType;         // Typed event identifier
  source: string;          // Originating system (e.g., "graph-engine")
  correlationId: string;   // Links related events in a chain
  causationId?: string;    // Parent event that caused this one
  timestamp: string;       // ISO 8601
  projectId?: string;      // Project scope
  userId?: string;         // User who triggered the mutation
  payload: Record<string, unknown>;  // Event-specific data
  metadata: {
    version: number;       // Schema version
    priority: 'normal' | 'high' | 'low';
  };
}
```

## Publishing

Events are published through `EventPublisher`:

```typescript
await eventPublisher.publish(channel, event);
await eventPublisher.publishBatch(channel, events);
```

**Critical:** Publisher needs its own Redis connection (`redis.duplicate()`). Sharing a connection with a subscriber causes "Connection in subscriber mode" errors.

## Subscribing

Events are consumed through `EventSubscriber`:

```typescript
eventSubscriber.subscribe(channel, handler);
eventSubscriber.unsubscribe(channel, handler);
```

**Critical:** Subscriber needs its own Redis connection (`redis.duplicate()`), separate from publisher.

## WebSocket Bridge

The `SocketIOAdapter` bridges Redis events to WebSocket rooms:

- `genesis-1.graph.*` → broadcast to project room (real-time canvas sync)
- `genesis-1.agent.execution.*` → execution progress updates
- `genesis-1.simulation.run.*` → simulation metrics streaming
- `genesis-1.generation.*` → code generation progress

## Event Persistence

`EventLogger` persists all events to the `events.event_log` table for audit and replay.

## Three-Tier Policy

| Layer | Policy | Mechanism |
|-------|--------|-----------|
| Event Publishing | FIRE-AND-FORGET | Errors are logged, not thrown |
| Event Subscribing | FAIL-OPEN | Parse errors are caught and logged |
| Event Logging | FAIL-OPEN | DB errors are caught and logged |
