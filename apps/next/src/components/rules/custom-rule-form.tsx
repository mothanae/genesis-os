'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface Props {
  projectId: string;
  ruleSetId: string;
  onCreated: () => void;
}

const DOMAINS = ['graph', 'security', 'scalability', 'compatibility', 'deployment'];
const SEVERITIES = ['error', 'warning', 'info'];

export function CustomRuleForm({ projectId, ruleSetId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('graph');
  const [condition, setCondition] = useState('{"gte": [{"var": "nodeCount"}, 1]}');
  const [severity, setSeverity] = useState('warning');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="text-sm text-blue-600 hover:underline">
        + Create custom rule
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(condition);
    } catch {
      setError('Condition must be valid JSON');
      setCreating(false);
      return;
    }

    try {
      await apiClient(`/api/v1/projects/${projectId}/rules/rules`, {
        method: 'POST',
        body: {
          ruleSetId,
          name,
          description,
          domain,
          condition: parsed,
          action: { type: 'violation', severity, message: message || `Rule violation: ${name}` },
          priority: 100,
          evaluationMode: 'reactive',
        },
      });
      setName('');
      setDescription('');
      setMessage('');
      setShow(false);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New Rule</h3>
        <button type="button" onClick={() => setShow(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full border rounded px-2 py-1 text-sm mt-0.5" placeholder="e.g. no_single_point_of_failure" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Domain</label>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm mt-0.5">
            {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm mt-0.5" placeholder="What does this rule check?" />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Condition (JSON Logic)</label>
        <textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={3}
          className="w-full border rounded px-2 py-1 text-sm mt-0.5 font-mono" />
        <span className="text-xs text-gray-400">Uses JSON Logic operators: eq, gt, lt, gte, lte, in, not_in, contains, and, or, not, var</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm mt-0.5">
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Violation Message</label>
          <input value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm mt-0.5" placeholder="Displayed when rule matches" />
        </div>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <button type="submit" disabled={creating}
        className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
        {creating ? 'Creating...' : 'Create Rule'}
      </button>
    </form>
  );
}
