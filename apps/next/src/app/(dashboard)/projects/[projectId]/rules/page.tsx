'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { CustomRuleForm } from '@/components/rules/custom-rule-form';

interface RuleViolation {
  id: string;
  ruleId: string;
  severity: string;
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
}

interface RuleSet {
  id: string;
  name: string;
  description: string | null;
  evaluationStrategy: string;
  enabled: boolean;
}

interface RuleDefinition {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  enabled: boolean;
  priority: number;
  ruleSetId: string | null;
}

export default function RulesPage() {
  const { projectId } = useParams();
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [violationsData, setsData] = await Promise.all([
        apiClient<RuleViolation[]>(`/api/v1/projects/${projectId}/rules/violations`),
        apiClient<RuleSet[]>(`/api/v1/projects/${projectId}/rules/sets`),
      ]);
      setViolations(Array.isArray(violationsData) ? violationsData : []);
      setRuleSets(Array.isArray(setsData) ? setsData : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadRulesForSet(setId: string) {
    try {
      const data = await apiClient<RuleDefinition[]>(`/api/v1/projects/${projectId}/rules/rules?ruleSetId=${setId}`);
      setRules(Array.isArray(data) ? data : []);
      setSelectedSet(setId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function evaluateRules() {
    setEvaluating(true);
    try {
      // First get the graph validation context
      const validation = await apiClient<{ context: Record<string, unknown> }>(
        `/api/v1/projects/${projectId}/graph/validate`,
      );

      // Run evaluation with graph context against all rulesets
      const results = await apiClient<unknown[]>(`/api/v1/projects/${projectId}/rules/evaluate`, {
        method: 'POST',
        body: { facts: validation?.context ?? {} },
      });

      await loadAll();
      setEvaluating(false);
    } catch (e) {
      setError((e as Error).message);
      setEvaluating(false);
    }
  }

  async function resolveViolation(violationId: string) {
    try {
      await apiClient(`/api/v1/projects/${projectId}/rules/violations/${violationId}/resolve`, {
        method: 'POST',
      });
      setViolations((prev) =>
        prev.map((v) => (v.id === violationId ? { ...v, resolvedAt: new Date().toISOString() } : v)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createPresetRuleSet(preset: { name: string; description: string; rules: string[] }) {
    try {
      await apiClient(`/api/v1/projects/${projectId}/rules/sets`, {
        method: 'POST',
        body: {
          name: preset.name,
          description: preset.description,
          evaluationStrategy: 'all-match',
        },
      });
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const severityConfig: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  };

  const activeViolations = violations.filter((v) => !v.resolvedAt);
  const resolvedViolations = violations.filter((v) => v.resolvedAt);

  const presets = [
    { name: 'Graph Architecture', description: 'Cycle detection, orphan nodes, fan-out limits, port validation', rules: ['no_cyclic_dependencies', 'no_orphaned_nodes', 'valid_connections', 'max_fan_out', 'missing_runtime_config', 'no_self_references', 'no_duplicate_edges'] },
    { name: 'Security Validator', description: 'Authentication, authorization, and exposure checks', rules: ['auth_required_for_public_endpoints', 'api_gateway_required', 'no_secret_exposure'] },
    { name: 'Scalability Validator', description: 'Single points of failure, load balancing, connection pooling', rules: ['no_single_point_of_failure', 'load_balancer_required', 'connection_pooling_configured'] },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rule Engine</h1>
          <p className="text-sm text-gray-500 mt-1">Project: {projectId as string}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={evaluateRules}
            disabled={evaluating}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {evaluating ? 'Evaluating...' : 'Evaluate Rules'}
          </button>
        </div>
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
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Summary Stats */}
      {!loading && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="border rounded-lg p-3">
            <div className="text-2xl font-bold">{ruleSets.length}</div>
            <div className="text-xs text-gray-500">Rule Sets</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-2xl font-bold text-red-600">{activeViolations.length}</div>
            <div className="text-xs text-gray-500">Active Violations</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">{resolvedViolations.length}</div>
            <div className="text-xs text-gray-500">Resolved</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-2xl font-bold">{rules.length}</div>
            <div className="text-xs text-gray-500">Rules</div>
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Rule Presets</h2>
        <div className="grid grid-cols-3 gap-3">
          {presets.map((preset) => {
            const exists = ruleSets.some((rs) => rs.name === preset.name);
            return (
              <div key={preset.name} className="border rounded-lg p-4 hover:shadow-md">
                <div className="text-lg mb-1">📋</div>
                <div className="font-semibold text-sm">{preset.name}</div>
                <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {preset.rules.map((rule) => (
                    <span key={rule} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                      {rule}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => createPresetRuleSet(preset)}
                  disabled={exists}
                  className="mt-3 w-full py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {exists ? 'Already Added' : 'Add Rule Set'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rule Sets */}
      {ruleSets.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Rule Sets</h2>
          <div className="space-y-2">
            {ruleSets.map((rs) => (
              <div
                key={rs.id}
                className={`border rounded-lg p-3 cursor-pointer hover:shadow-md ${selectedSet === rs.id ? 'border-blue-400 bg-blue-50' : ''}`}
                onClick={() => loadRulesForSet(rs.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{rs.name}</div>
                    <div className="text-xs text-gray-500">{rs.description ?? 'No description'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{rs.evaluationStrategy}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${rs.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {rs.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Rule Creator (shown when a ruleset is selected) */}
      {selectedSet && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Custom Rule</h2>
          </div>
          <CustomRuleForm
            projectId={projectId as string}
            ruleSetId={selectedSet}
            onCreated={() => loadRulesForSet(selectedSet)}
          />
        </div>
      )}

      {/* Violations */}
      {violations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">
            Violations ({activeViolations.length} active, {resolvedViolations.length} resolved)
          </h2>
          <div className="space-y-2">
            {violations.map((v) => {
              const config = severityConfig[v.severity] ?? severityConfig.info;
              return (
                <div key={v.id} className={`border rounded-lg p-3 ${config.bg} ${config.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.badge}`}>
                      {v.severity}
                    </span>
                    <span className={`text-sm ${config.text} flex-1`}>{v.message}</span>
                    {v.resolvedAt ? (
                      <span className="text-xs text-green-600">Resolved {new Date(v.resolvedAt).toLocaleDateString()}</span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); resolveViolation(v.id); }}
                        className="text-xs px-2 py-0.5 bg-white border rounded hover:bg-gray-50"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(v.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && ruleSets.length === 0 && violations.length === 0 && (
        <div className="mt-12 text-center text-gray-400">
          <p className="text-lg">No rule sets configured</p>
          <p className="text-sm mt-1">Add a rule preset above to start validating your architecture.</p>
        </div>
      )}
    </div>
  );
}
