import type { DatabaseClient } from '@genesis-1/database';
import type { EventPublisher } from '@genesis-1/event-bus';
import type { SimulationRun, SimulationMetrics } from '@genesis-1/shared';
import { EventType } from '@genesis-1/shared';
import { simulationRuns, simulationEvents } from '@genesis-1/database';
import { eq } from 'drizzle-orm';

export interface SimulationEngineConfig {
  db: DatabaseClient;
  eventBus: EventPublisher;
}

// ── State Types ───────────────────────────────────────────────

export interface ServiceState {
  id: string; name: string; replicas: number;
  cpuUtilization: number; memoryUtilization: number;
  requestCount: number; errorCount: number;
  avgLatencyMs: number; status: 'healthy' | 'degraded' | 'down';
  lastHealthCheck: number;
}

export interface DatabaseState {
  id: string; name: string;
  activeConnections: number; maxConnections: number;
  queryLatencyMs: number; writeThroughput: number;
  readThroughput: number; diskUsagePercent: number;
  replicationLagMs: number;
}

export interface QueueState {
  id: string; name: string; queueDepth: number;
  processingRate: number; consumerCount: number;
  avgMessageLatencyMs: number; dlqDepth: number;
}

export interface CacheState {
  id: string; name: string; hitRate: number;
  evictionRate: number; memoryUsedMB: number; keyCount: number;
}

export interface NetworkState {
  totalRequests: number; activeConnections: number;
  bandwidthMbps: number; packetLossPercent: number; latencyMs: number;
}

export interface SimEventRecord {
  simTime: number; type: string; source: string;
  target?: string; payload: Record<string, unknown>;
  duration?: number; success: boolean;
}

export interface RuntimeMetricsCollection {
  requestCounts: number[];
  latencyBuckets: Map<string, number[]>;
  errorRateTimeline: number[];
  throughputTimeline: number[];
  availabilityTimeline: number[];
  cpuTimeline: number[];
  memoryTimeline: number[];
}

export interface SimState {
  clock: number;
  services: Map<string, ServiceState>;
  databases: Map<string, DatabaseState>;
  queues: Map<string, QueueState>;
  caches: Map<string, CacheState>;
  network: NetworkState;
  events: SimEventRecord[];
  metrics: RuntimeMetricsCollection;
}

export interface SimulationConfig {
  projectId: string;
  simulationId: string;
  initialState: Record<string, unknown>;
  duration: number;
  tickInterval: number;
  generators: Array<{
    type: 'http_traffic' | 'db_queries' | 'events' | 'auth' | 'background_jobs' | 'websocket';
    config: Record<string, unknown>;
    enabled: boolean;
  }>;
  failureInjection?: {
    enabled: boolean;
    types: Array<'crash' | 'latency_spike' | 'network_partition' | 'oom' | 'disk_full'>;
    frequency: number;
    durationMs: number;
  };
  scaling?: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    cpuThreshold: number;
    memoryThreshold: number;
    cooldownTicks: number;
  };
  loadProfile?: {
    type: 'constant' | 'ramp' | 'spike' | 'sinusoidal' | 'real_world';
    baseRps: number;
    peakRps?: number;
    rampDurationTicks?: number;
  };
}

// ── Engine ────────────────────────────────────────────────────

export class SimulationEngine {
  constructor(private readonly config: SimulationEngineConfig) {}

  async runSimulation(
    simId: string,
    projectId: string,
    triggeredBy: string,
    simConfig: SimulationConfig,
  ): Promise<SimulationRun> {
    const result = await this.config.db
      .insert(simulationRuns)
      .values({ definitionId: simId, projectId, triggeredBy, status: 'running', startedAt: new Date() })
      .returning();
    const run = result[0]!;

    await this.publish(EventType.SimulationRunStarted, projectId, { runId: run.id, simId });

    try {
      const state = this.initState(simConfig.initialState);
      const totalTicks = Math.ceil(simConfig.duration / simConfig.tickInterval);

      for (let tick = 0; tick < totalTicks; tick++) {
        state.clock = tick * simConfig.tickInterval;

        // 1. Generate events
        for (const gen of simConfig.generators) {
          if (!gen.enabled) continue;
          state.events.push(...this.generateSimEvents(gen.type, state, simConfig));
        }

        // 2. Process events
        while (state.events.length > 0) {
          const evt = state.events.shift()!;
          this.applyEvent(evt, state);

          await this.config.db.insert(simulationEvents).values({
            runId: run.id, simTime: evt.simTime, eventType: evt.type,
            source: evt.source, payload: evt.payload,
          });
        }

        // 3. Apply scaling
        if (simConfig.scaling?.enabled) {
          for (const [, svc] of state.services) {
            if (svc.status !== 'healthy') continue;
            const t = simConfig.scaling;
            if (svc.cpuUtilization > t.cpuThreshold && svc.replicas < t.maxReplicas) svc.replicas++;
            else if (svc.cpuUtilization < t.cpuThreshold * 0.5 && svc.replicas > t.minReplicas) svc.replicas--;
          }
        }

        // 4. Inject failures
        if (simConfig.failureInjection?.enabled && Math.random() < simConfig.failureInjection.frequency) {
          this.injectFailure(state, simConfig.failureInjection);
        }

        // 5. Collect metrics
        state.metrics.requestCounts.push(state.network.totalRequests);
        const totalReq = Array.from(state.services.values()).reduce((s, sv) => s + sv.requestCount, 0);
        const totalErr = Array.from(state.services.values()).reduce((s, sv) => s + sv.errorCount, 0);
        state.metrics.errorRateTimeline.push(totalReq > 0 ? totalErr / totalReq : 0);
        state.metrics.cpuTimeline.push(
          Array.from(state.services.values()).reduce((s, sv) => s + sv.cpuUtilization, 0) / Math.max(state.services.size, 1),
        );

        // 6. Progress update
        if (tick % 10 === 0 || tick === totalTicks - 1) {
          await this.publish(EventType.SimulationRunProgress, projectId, {
            runId: run.id, tick, totalTicks, simTime: state.clock,
            serviceCount: state.services.size, totalRequests: state.network.totalRequests,
          });
        }
      }

      const metrics = this.finalMetrics(state, totalTicks);
      await this.config.db.update(simulationRuns).set({
        status: 'completed', totalSteps: totalTicks, clockEnd: state.clock, metrics, completedAt: new Date(),
      }).where(eq(simulationRuns.id, run.id));

      await this.publish(EventType.SimulationRunCompleted, projectId, { runId: run.id, totalTicks, metrics });
      return { ...run, status: 'completed', totalSteps: totalTicks, clockEnd: state.clock, metrics } as unknown as SimulationRun;
    } catch (error) {
      await this.config.db.update(simulationRuns).set({
        status: 'failed', error: (error as Error).message, completedAt: new Date(),
      }).where(eq(simulationRuns.id, run.id));
      await this.publish(EventType.SimulationRunFailed, projectId, { runId: run.id, error: (error as Error).message });
      throw error;
    }
  }

  // ── Event Generators ───────────────────────────────────────

  private generateSimEvents(type: string, state: SimState, config: SimulationConfig): SimEventRecord[] {
    const events: SimEventRecord[] = [];
    const rps = this.computeRps(state.clock, config.loadProfile);

    switch (type) {
      case 'http_traffic':
        for (const [sid, svc] of state.services) {
          if (svc.status !== 'healthy') continue;
          const n = Math.floor(rps / Math.max(state.services.size, 1));
          for (let i = 0; i < n; i++) {
            const lat = (state.network.latencyMs * (0.5 + Math.random())) + ((svc.cpuUtilization / 100) * 50);
            const ok = Math.random() > 0.001;
            events.push({ simTime: state.clock, type: 'http.request.completed', source: sid, payload: { statusCode: ok ? 200 : 500 }, duration: lat, success: ok });
            svc.requestCount++; if (!ok) svc.errorCount++;
            svc.avgLatencyMs = svc.avgLatencyMs * 0.9 + lat * 0.1;
            svc.cpuUtilization = Math.min(100, svc.cpuUtilization + (rps / 500));
          }
        }
        break;
      case 'db_queries':
        for (const [did, db] of state.databases) {
          const q = Math.floor(db.activeConnections * (0.5 + Math.random() * 0.5));
          for (let i = 0; i < q; i++) {
            const ok = db.activeConnections < db.maxConnections && db.diskUsagePercent < 95;
            events.push({ simTime: state.clock, type: Math.random() < 0.3 ? 'database.write' : 'database.read', source: did, payload: { rows: Math.floor(Math.random() * 100) }, duration: db.queryLatencyMs * (0.5 + Math.random()), success: ok });
            if (ok) { if (Math.random() < 0.3) db.writeThroughput++; else db.readThroughput++; }
          }
        }
        break;
      case 'events':
        for (const [qid, q] of state.queues) {
          const prod = Math.floor(q.processingRate * (0.8 + Math.random() * 0.4));
          const cons = Math.floor(Math.min(q.queueDepth, q.processingRate * q.consumerCount));
          events.push({ simTime: state.clock, type: 'event.published', source: qid, payload: { count: prod }, success: true });
          events.push({ simTime: state.clock, type: 'event.consumed', source: qid, payload: { count: cons }, duration: q.avgMessageLatencyMs, success: true });
          q.queueDepth = Math.max(0, q.queueDepth + prod - cons);
        }
        break;
      case 'auth':
        for (let i = 0; i < Math.floor(rps * 0.1); i++) {
          events.push({ simTime: state.clock, type: Math.random() < 0.3 ? 'auth.login' : 'auth.token_verify', source: 'auth_service', payload: { userId: `u_${Math.floor(Math.random() * 1000)}` }, duration: 5 + Math.random() * 20, success: Math.random() > 0.01 });
        }
        break;
      case 'background_jobs':
        for (const [sid, svc] of state.services) {
          if (svc.status !== 'healthy') continue;
          for (let i = 0; i < Math.floor(Math.random() * 3); i++) {
            events.push({ simTime: state.clock, type: 'job.completed', source: sid, payload: { jobType: 'cleanup' }, duration: 50 + Math.random() * 200, success: true });
          }
        }
        break;
      case 'websocket':
        events.push({ simTime: state.clock, type: 'ws.message.sent', source: 'ws_server', payload: { msgCount: Math.floor(state.network.activeConnections * 0.01) }, duration: 1 + Math.random() * 5, success: true });
        break;
    }
    state.network.totalRequests += events.length;
    return events;
  }

  private applyEvent(evt: SimEventRecord, state: SimState): void {
    const svc = state.services.get(evt.source);
    if (svc && !evt.success) { svc.errorCount++; svc.cpuUtilization = Math.min(100, svc.cpuUtilization + 2); }
    if (svc) svc.cpuUtilization = Math.max(0, svc.cpuUtilization - 0.01);
  }

  private injectFailure(state: SimState, fi: SimulationConfig['failureInjection']): void {
    if (!fi) return;
    const type = fi.types[Math.floor(Math.random() * fi.types.length)]!;
    const svcs = Array.from(state.services.values());
    const target = svcs[Math.floor(Math.random() * svcs.length)];
    if (!target) return;
    switch (type) {
      case 'crash': target.status = 'down'; target.replicas = Math.max(0, target.replicas - 1); break;
      case 'latency_spike': target.avgLatencyMs *= 10; break;
      case 'network_partition': state.network.packetLossPercent = 50; break;
      case 'oom': target.memoryUtilization = 100; target.status = 'degraded'; break;
      case 'disk_full': for (const [, d] of state.databases) d.diskUsagePercent = 100; break;
    }
  }

  // ── Metrics ────────────────────────────────────────────────

  private finalMetrics(state: SimState, totalTicks: number): SimulationMetrics {
    const lats: number[] = []; for (const [, s] of state.services) lats.push(s.avgLatencyMs); lats.sort((a, b) => a - b);
    const totalReq = state.network.totalRequests;
    const totalErr = Array.from(state.services.values()).reduce((s, sv) => s + sv.errorCount, 0);
    return {
      avgLatencyP50: this.pct(lats, 50), avgLatencyP95: this.pct(lats, 95), avgLatencyP99: this.pct(lats, 99),
      throughput: totalReq / (totalTicks * 0.1),
      errorRate: totalReq > 0 ? (totalErr / totalReq) * 100 : 0,
      availability: totalReq > 0 ? 100 - (totalErr / totalReq) * 100 : 100,
      cascadeDepth: 0, recoveryTimeMs: 0,
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  private computeRps(clock: number, profile?: SimulationConfig['loadProfile']): number {
    if (!profile) return 100;
    const { type, baseRps, peakRps, rampDurationTicks } = profile;
    switch (type) {
      case 'ramp': return baseRps * (1 + clock / (rampDurationTicks || 100));
      case 'spike': { const p = rampDurationTicks || 50; return clock % p < p * 0.1 ? (peakRps ?? baseRps * 10) : baseRps; }
      case 'sinusoidal': return baseRps + ((peakRps ?? baseRps * 2) - baseRps) * Math.sin((clock / 100) * Math.PI * 2);
      case 'real_world': return baseRps * (0.5 + Math.random());
      default: return baseRps;
    }
  }

  private initState(initial: Record<string, unknown>): SimState {
    return {
      clock: 0,
      services: new Map(Object.entries((initial.services as Record<string, unknown>) ?? {})),
      databases: new Map(Object.entries((initial.databases as Record<string, unknown>) ?? {})),
      queues: new Map(Object.entries((initial.queues as Record<string, unknown>) ?? {})),
      caches: new Map(Object.entries((initial.caches as Record<string, unknown>) ?? {})),
      network: { totalRequests: 0, activeConnections: 0, bandwidthMbps: 1000, packetLossPercent: 0, latencyMs: 1 },
      events: [],
      metrics: { requestCounts: [], latencyBuckets: new Map(), errorRateTimeline: [], throughputTimeline: [], availabilityTimeline: [], cpuTimeline: [], memoryTimeline: [] },
    };
  }

  private pct(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
  }

  private async publish(type: EventType, projectId: string, payload: Record<string, unknown>): Promise<void> {
    await this.config.eventBus.publish(type as string, {
      id: crypto.randomUUID(), type, source: 'simulation-engine', correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(), projectId, payload, metadata: { version: 1, priority: 'normal' },
    });
  }
}
