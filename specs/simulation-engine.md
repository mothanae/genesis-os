# Genesis OS — Simulation Engine Specification

## Overview

A discrete-event simulator that executes generated architectures in a sandbox before deployment. Visualizes runtime behavior, detects bottlenecks, and validates scaling assumptions.

## Architecture

The simulation engine operates on a tick-based loop:

```
INITIALIZE STATE → GENERATE EVENTS → PROCESS EVENTS → UPDATE STATE → CHECK TERMINATION → NEXT TICK
```

## Simulation State

Five tracked state domains:

| Domain | Metrics |
|--------|---------|
| **ServiceState** | status, replicas, cpu, memory, avgLatency, errorCount |
| **DatabaseState** | connections, queryLatency, cacheHitRate, deadlocks |
| **QueueState** | depth, processingRate, avgWaitTime, dlqCount |
| **CacheState** | hitRate, evictionRate, memoryUsed |
| **NetworkState** | latency, packetLoss, bandwidth |

## Event Generators (6 types)

| Generator | Description | Produces |
|-----------|-------------|----------|
| `http_traffic` | API request simulation | HTTP request/response events with latency |
| `db_queries` | Database load simulation | Read/write query events |
| `events` | Pub/sub event simulation | Publish/subscribe/delivery events |
| `auth` | Authentication flow | Login/refresh/token-validation events |
| `background_jobs` | Async job processing | Enqueue/process/complete events |
| `websocket` | Real-time messaging | Connect/message/disconnect events |

## Load Profiles (5 types)

| Profile | Pattern | Use Case |
|---------|---------|----------|
| `constant` | Steady rate | Baseline performance |
| `ramp` | Linear increase | Capacity planning |
| `spike` | Sudden burst | Failover/scaling test |
| `sinusoidal` | Periodic wave | Daily traffic pattern |
| `real_world` | Random with bursts | Production simulation |

## Failure Injection (5 types)

| Failure | Effect |
|---------|--------|
| `crash` | Service stops processing |
| `latency_spike` | Response time increases 10x |
| `network_partition` | Service unreachable from others |
| `oom` | Service allocates until failure |
| `disk_full` | Database writes fail |

## Metrics Output

- **P50/P95/P99 latency** — Request response time distribution
- **Throughput** — Requests per second
- **Error rate** — Percentage of failed requests
- **Availability** — Uptime percentage
- **Cascade depth** — How far failures propagate
- **Recovery time** — Time to return to healthy state

## Termination Conditions

Configurable via `termination` config:
- `maxSteps` — Maximum simulation ticks (default: 10000)
- `maxTime` — Maximum wall-clock time in seconds (default: 3600)
- `stabilityThreshold` — Stop when metrics stabilize (default: 0.01 change)

## Auto-Scaling

During simulation, services auto-scale based on CPU thresholds:
- CPU > 80% → add replicas (up to max)
- CPU < 20% → remove replicas (down to min)

## Visual Output

The SimulationViewer React component renders:
- Real-time metric cards (P50/P95/P99, throughput, error rate, availability)
- Service health grid with status indicators
- Bottleneck detection (CPU > 70% or latency > 100ms)
- Event timeline with color-coded success/failure

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:projectId/simulations` | GET | List simulation definitions |
| `/:projectId/simulations` | POST | Create simulation definition |
| `/:projectId/simulations/:id` | GET/PATCH/DELETE | Manage simulation |
| `/:projectId/simulations/:id/run` | POST | Start simulation run |
| `/:projectId/simulations/:id/runs` | GET | List runs |
| `/:projectId/simulations/:id/runs/:runId` | GET | Get run details |
| `/:projectId/simulations/:id/runs/:runId/events` | GET | Get run events |
