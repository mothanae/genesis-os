'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface RuleViolation {
  id: string;
  ruleId: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  resolvedAt?: string | null;
}

interface RulePreset {
  name: string;
  description: string;
  ruleCount: number;
  rules: string[];
}

export default function RulesPage() {
  const { projectId } = useParams();
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    loadViolations();
  }, [projectId]);

  async function loadViolations() {
    setLoading(true);
    try {
      const data = await apiClient<RuleViolation[]>(`/api/v1/projects/${projectId}/rules/violations`);
      setViolations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function evaluateRules() {
    setEvaluating(true);
    try {
      await apiClient(`/api/v1/projects/${projectId}/rules/evaluate`, { method: 'POST' });
      await loadViolations();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEvaluating(false);
    }
  }

  const presets: RulePreset[] = [
    {
      name: 'Graph Architecture',
      description: 'Validates graph topology, dependencies, and node relationships',
      ruleCount: 6,
      rules: ['Cycle detection', 'Orphan detection', 'Port validation', 'Fan-out limits', 'Missing dependencies', 'Self-reference check'],
    },
    {
      name: 'Security Validator',
      description: 'Checks for security anti-patterns in the architecture',
      ruleCount: 3,
      rules: ['Public endpoint check', 'Auth gateway required', 'Secret exposure detection'],
    },
    {
      name: 'Scalability Validator',
      description: 'Ensures architecture can scale under load',
      ruleCount: 3,
      rules: ['Single point of failure', 'Missing load balancer', 'Database connection pooling'],
    },
  ];

  const severityConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rule Engine</h1>
          <p className="text-sm text-gray-500 mt-1">Project: {projectId as string}</p>
        </div>
        <button
          onClick={evaluateRules}
          disabled={evaluating}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {evaluating ? 'Evaluating...' : 'Evaluate Rules'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 mt-6">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Rule Presets */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {presets.map((preset) => (
          <div key={preset.name} className="border rounded-lg p-4 hover:shadow-md">
            <div className="text-lg mb-1">📋</div>
            <div className="font-semibold text-sm">{preset.name}</div>
            <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {preset.rules.map((rule) => (
                <span key={rule} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {rule}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">
            Violations ({violations.length})
          </h2>
          <div className="space-y-2">
            {violations.map((v) => {
              const config = severityConfig[v.severity] ?? severityConfig.info;
              return (
                <div
                  key={v.id}
                  className={`border rounded-lg p-3 ${config.bg} ${config.border}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.badge}`}>
                      {v.severity}
                    </span>
                    <span className={`text-sm ${config.text}`}>{v.message}</span>
                    {v.resolvedAt && (
                      <span className="text-xs text-green-600 ml-auto">Resolved</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
