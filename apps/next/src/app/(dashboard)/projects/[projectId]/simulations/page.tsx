'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface SimulationRun {
  id: string;
  definitionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalSteps: number;
  clockEnd: number;
  metrics?: {
    avgLatencyP50: number;
    avgLatencyP95: number;
    avgLatencyP99: number;
    throughput: number;
    errorRate: number;
    availability: number;
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface SimulationDef {
  id: string;
  name: string;
  description?: string;
  version: number;
}

const GENERATORS = [
  { type: 'http_traffic', label: 'HTTP Traffic', desc: 'Simulates API requests to services', emoji: '🌐' },
  { type: 'db_queries', label: 'DB Queries', desc: 'Simulates database read/write load', emoji: '🗄️' },
  { type: 'events', label: 'Pub/Sub Events', desc: 'Simulates event publishing and consumption', emoji: '📡' },
  { type: 'auth', label: 'Auth Flow', desc: 'Simulates authentication requests', emoji: '🔐' },
  { type: 'background_jobs', label: 'Background Jobs', desc: 'Simulates async job processing', emoji: '⚡' },
  { type: 'websocket', label: 'WebSocket', desc: 'Simulates real-time messaging', emoji: '🔌' },
];

export default function SimulationsPage() {
  const { projectId } = useParams();
  const [simulations, setSimulations] = useState<SimulationDef[]>([]);
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSim, setSelectedSim] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadSimulations();
  }, [projectId]);

  async function loadSimulations() {
    setLoading(true);
    try {
      const data = await apiClient<SimulationDef[]>(`/api/v1/projects/${projectId}/simulations`);
      setSimulations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRuns(simId: string) {
    setSelectedSim(simId);
    try {
      const data = await apiClient<SimulationRun[]>(`/api/v1/projects/${projectId}/simulations/${simId}/runs`);
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      // Runs may not exist yet
    }
  }

  async function startSimulation(simId: string) {
    setRunning(true);
    try {
      const run = await apiClient<SimulationRun>(`/api/v1/projects/${projectId}/simulations/${simId}/run`, {
        method: 'POST',
      });
      setRuns((prev) => [run, ...prev]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Runtime Simulations</h1>
      <p className="text-sm text-gray-500 mt-1">Project: {projectId as string}</p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 mt-6">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading simulations...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Generator Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {GENERATORS.map((gen) => (
          <button
            key={gen.type}
            onClick={() => startSimulation(gen.type as any)}
            disabled={running}
            className="border rounded-lg p-4 hover:shadow-md text-left disabled:opacity-50 transition"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{gen.emoji}</div>
              <div>
                <div className="font-semibold text-sm">{gen.label}</div>
                <div className="text-xs text-gray-500 mt-1">{gen.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Existing Simulations */}
      {simulations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Saved Simulations</h2>
          <div className="space-y-2">
            {simulations.map((sim) => (
              <div key={sim.id}>
                <button
                  onClick={() => loadRuns(sim.id)}
                  className={`w-full text-left border rounded-lg p-3 hover:shadow transition ${
                    selectedSim === sim.id ? 'border-blue-400 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{sim.name}</span>
                      {sim.description && (
                        <span className="text-xs text-gray-500 ml-2">{sim.description}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">v{sim.version}</span>
                  </div>
                </button>

                {selectedSim === sim.id && (
                  <div className="ml-4 mt-2 space-y-1">
                    {runs.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">No runs yet. Start a simulation above.</p>
                    ) : (
                      runs.map((run) => (
                        <div key={run.id} className="border rounded p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded font-medium ${statusColors[run.status] ?? ''}`}>
                              {run.status}
                            </span>
                            <span className="text-gray-500">
                              {run.totalSteps} steps | {new Date(run.startedAt).toLocaleTimeString()}
                            </span>
                          </div>
                          {run.metrics && (
                            <div className="mt-1 grid grid-cols-4 gap-2 text-gray-600">
                              <div>P50: {run.metrics.avgLatencyP50.toFixed(1)}ms</div>
                              <div>P95: {run.metrics.avgLatencyP95.toFixed(1)}ms</div>
                              <div>Throughput: {run.metrics.throughput.toFixed(0)} req/s</div>
                              <div>Avail: {run.metrics.availability.toFixed(1)}%</div>
                            </div>
                          )}
                          {run.error && (
                            <div className="mt-1 text-red-600">{run.error}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
