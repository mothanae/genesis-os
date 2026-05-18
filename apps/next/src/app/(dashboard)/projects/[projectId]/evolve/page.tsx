'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface ArchitectureInsight {
  id: string;
  title: string;
  type: string;
  description: string;
  suggestion: string;
  severity: 'critical' | 'warning' | 'info';
}

interface EvolutionTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export default function EvolvePage() {
  const { projectId } = useParams();
  const [insights, setInsights] = useState<ArchitectureInsight[]>([]);
  const [templates, setTemplates] = useState<EvolutionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [evolving, setEvolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evolveResult, setEvolveResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [insightsData, templatesData] = await Promise.all([
        apiClient<ArchitectureInsight[]>(`/api/v1/projects/${projectId}/insights`).catch(() => []),
        apiClient<EvolutionTemplate[]>(`/api/v1/projects/${projectId}/templates`).catch(() => []),
      ]);
      setInsights(Array.isArray(insightsData) ? insightsData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
    } catch {
      // Graceful fallback — show defaults
    } finally {
      setLoading(false);
    }
  }

  async function handleEvolve() {
    setEvolving(true);
    setError(null);
    try {
      const result = await apiClient<{ message: string }>(`/api/v1/projects/${projectId}/evolve`, {
        method: 'POST',
      });
      const msg = result as { message?: string } | undefined;
      setEvolveResult(msg?.message ?? 'Evolution complete');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEvolving(false);
    }
  }

  const severityConfig = {
    critical: { bg: 'bg-red-50 border-red-300', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
    info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evolution Engine</h1>
          <p className="text-sm text-gray-500 mt-1">Project: {projectId as string}</p>
        </div>
        <button
          onClick={handleEvolve}
          disabled={evolving}
          className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {evolving ? 'Evolving...' : 'Evolve Architecture'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 mt-6">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Analyzing architecture...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {evolveResult && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 text-green-700 text-sm">
          {evolveResult}
        </div>
      )}

      {/* Architecture Insights */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">
          Architecture Insights ({insights.length})
        </h2>
        {insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight) => {
              const config = severityConfig[insight.severity] ?? severityConfig.info;
              return (
                <div
                  key={insight.id}
                  className={`border rounded-lg p-4 ${config.bg}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.badge}`}>
                      {insight.severity}
                    </span>
                    <span className="font-semibold text-sm">{insight.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white text-gray-600">
                      {insight.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
                  <p className="text-xs text-gray-700 mt-1.5 font-medium">
                    Suggestion: {insight.suggestion}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">
            No architecture insights yet. Click "Evolve Architecture" to analyze the graph and generate insights.
          </p>
        )}
      </div>

      {/* Evolution Templates */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">
          Architecture Templates ({templates.length})
        </h2>
        {templates.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="border rounded-lg p-3 hover:shadow-md transition">
                <div className="font-semibold text-sm">{tpl.name}</div>
                <p className="text-xs text-gray-500 mt-1">{tpl.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tpl.tags.map((tag) => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">
            No architecture templates matched. Templates are matched against your graph topology when you evolve the architecture.
          </p>
        )}
      </div>
    </div>
  );
}
