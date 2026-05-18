'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiClient } from '@/lib/api-client';

interface SimulationMetrics {
  avgLatencyP50: number;
  avgLatencyP95: number;
  avgLatencyP99: number;
  throughput: number;
  errorRate: number;
  availability: number;
  cascadeDepth: number;
  recoveryTimeMs: number;
}

interface SimEvent {
  id: string;
  simTime: number;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  success: boolean;
}

interface ServiceState {
  id: string;
  name: string;
  status: string;
  replicas: number;
  cpu: number;
  avgLatency: number;
}

interface SimulationState {
  clock: number;
  services: ServiceState[];
  totalRequests: number;
  totalEvents?: number;
}

export function SimulationViewer({ projectId }: { projectId: string }) {
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<SimulationState | null>(null);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);

  useWebSocket({
    projectId,
    onEvent: (msg) => {
      if (msg.type === 'genesis-1.simulation.run.progress') {
        const p = msg.payload as Record<string, unknown>;
        setState({
          clock: p.simTime as number,
          services: (p.services as ServiceState[]) ?? [],
          totalRequests: p.totalRequests as number,
          totalEvents: p.totalEvents as number,
        });
      }
      if (msg.type === 'genesis-1.simulation.run.completed') {
        setRunning(false);
        setMetrics((msg.payload as Record<string, unknown>).metrics as SimulationMetrics);
      }
    },
  });

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      // Create a simulation definition from the project graph
      const simDef = await apiClient<{ id: string }>(`/api/v1/projects/${projectId}/simulations`, {
        method: 'POST',
        body: {
          name: 'Runtime Simulation',
          description: 'Auto-generated simulation from graph topology',
          initialState: {},
          eventGenerators: [
            { type: 'http_traffic', config: { rps: 50 }, enabled: true },
            { type: 'db_queries', config: {}, enabled: true },
            { type: 'events', config: {}, enabled: true },
            { type: 'websocket', config: {}, enabled: true },
          ],
          termination: { maxSteps: 10000, maxTime: 3600 },
        },
      });

      // Start the simulation run
      await apiClient(`/api/v1/projects/${projectId}/simulations/${simDef.id}/run`, {
        method: 'POST',
      });

      setActiveSimId(simDef.id);
      setRunning(true);
      setMetrics(null);
      setEvents([]);
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!activeSimId) return;
    try {
      await apiClient(`/api/v1/projects/${projectId}/simulations/${activeSimId}/cancel`, {
        method: 'POST',
      });
    } catch {
      // Best-effort cancel
    }
    setRunning(false);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Runtime Simulation</h2>
        <button
          onClick={running ? handleStop : handleStart}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-white text-sm disabled:opacity-50 ${
            loading ? 'bg-gray-400' : running ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {loading ? 'Starting...' : running ? 'Stop' : 'Start Simulation'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-xs">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Metrics panels */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-4 gap-3"
        >
          <MetricCard label="P50 Latency" value={`${metrics.avgLatencyP50.toFixed(1)}ms`} color="text-blue-600" />
          <MetricCard label="P95 Latency" value={`${metrics.avgLatencyP95.toFixed(1)}ms`} color="text-yellow-600" />
          <MetricCard label="P99 Latency" value={`${metrics.avgLatencyP99.toFixed(1)}ms`} color="text-red-600" />
          <MetricCard label="Throughput" value={`${metrics.throughput.toFixed(0)} req/s`} color="text-green-600" />
          <MetricCard label="Error Rate" value={`${metrics.errorRate.toFixed(2)}%`} color={metrics.errorRate > 1 ? 'text-red-600' : 'text-green-600'} />
          <MetricCard label="Availability" value={`${metrics.availability.toFixed(2)}%`} color={metrics.availability < 99 ? 'text-red-600' : 'text-green-600'} />
          <MetricCard label="Cascade Depth" value={`${metrics.cascadeDepth}`} color="text-purple-600" />
          <MetricCard label="Recovery Time" value={`${metrics.recoveryTimeMs}ms`} color="text-orange-600" />
        </motion.div>
      )}

      {/* Service Health */}
      {state && state.services.length > 0 && (
        <div className="border rounded-lg p-3">
          <h3 className="text-sm font-semibold mb-2">Service Health</h3>
          <div className="space-y-1">
            {state.services.map((svc) => (
              <div key={svc.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    svc.status === 'healthy' ? 'bg-green-500' : svc.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="font-medium">{svc.name}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500">
                  <span>Replicas: {svc.replicas}</span>
                  <span>CPU: {svc.cpu.toFixed(0)}%</span>
                  <span>Lat: {svc.avgLatency.toFixed(1)}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottleneck visualization */}
      {state && state.services.length > 0 && (
        <div className="border rounded-lg p-3">
          <h3 className="text-sm font-semibold mb-2">Bottlenecks</h3>
          <div className="space-y-2">
            {state.services
              .filter((s) => s.cpu > 70 || s.avgLatency > 100)
              .map((svc) => (
                <motion.div
                  key={svc.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`flex items-center justify-between p-2 rounded text-xs ${
                    svc.cpu > 90 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <div className="font-semibold">{svc.name}</div>
                      <div className="text-gray-500">
                        {svc.cpu > 90 ? 'Critical CPU usage' : 'High latency detected'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{svc.cpu > 90 ? 'Scale up recommended' : 'Check dependencies'}</div>
                    <div className="text-gray-400">CPU: {svc.cpu.toFixed(0)}% / Lat: {svc.avgLatency.toFixed(1)}ms</div>
                  </div>
                </motion.div>
              ))}
            {state.services.filter((s) => s.cpu > 70 || s.avgLatency > 100).length === 0 && (
              <p className="text-xs text-green-600">No bottlenecks detected</p>
            )}
          </div>
        </div>
      )}

      {/* Event Timeline */}
      {events.length > 0 && (
        <div className="border rounded-lg p-3">
          <h3 className="text-sm font-semibold mb-2">Event Timeline</h3>
          <div className="max-h-48 overflow-y-auto">
            {events.slice(-50).map((evt) => (
              <div
                key={evt.id}
                className={`text-xs py-1 px-2 rounded mb-1 ${evt.success ? 'bg-gray-50' : 'bg-red-50'} flex items-center gap-2`}
              >
                <span className="text-gray-400 w-16">{evt.simTime.toFixed(1)}s</span>
                <span className={`w-2 h-2 rounded-full ${evt.success ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="font-medium">{evt.eventType}</span>
                <span className="text-gray-400">{evt.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-white border rounded-lg p-3 text-center"
    >
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </motion.div>
  );
}
