'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api-client';

interface DeployModule {
  path: string;
  type: string;
  description: string;
  language?: string;
}

interface DeployPlan {
  order: string[];
  estimatedMinutes: number;
  rollbackPlan: string[];
}

interface DeployResult {
  success: boolean;
  modules: DeployModule[];
  plan: DeployPlan;
  errors: string[];
}

export default function DeployPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [env, setEnv] = useState('development');
  const [platform, setPlatform] = useState('docker');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [dryRun, setDryRun] = useState(false);

  async function generateDeployment() {
    setLoading(true);
    try {
      const data = await apiClient<DeployResult>(
        `/api/v1/projects/${projectId}/deploy/${dryRun ? 'simulate' : 'generate'}`,
        {
          method: 'POST',
          body: { environment: env, platform, cloudProvider: 'aws', region: 'us-east-1' },
        },
      );
      setResult(data);
    } catch (err) {
      console.error('Deploy generation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deployment Engine</h1>
          <p className="text-sm text-gray-500">Generate deployment artifacts from graph topology</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="docker">Docker</option>
            <option value="kubernetes">Kubernetes</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry Run
          </label>
          <button
            onClick={generateDeployment}
            disabled={loading}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Deployment'}
          </button>
        </div>
      </div>

      {/* Deployment Plan */}
      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{result.modules.length}</div>
              <div className="text-xs text-gray-500">Total Modules</div>
            </div>
            <div className="bg-white border rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{result.plan.estimatedMinutes}</div>
              <div className="text-xs text-gray-500">Est. Minutes</div>
            </div>
            <div className="bg-white border rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">{result.plan.order.length}</div>
              <div className="text-xs text-gray-500">Deploy Steps</div>
            </div>
            <div className="bg-white border rounded-lg p-3">
              <div className={`text-2xl font-bold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {result.success ? 'PASS' : 'FAIL'}
              </div>
              <div className="text-xs text-gray-500">Validation</div>
            </div>
          </div>

          {/* Plan Timeline */}
          <div className="bg-white border rounded-lg p-4">
            <h2 className="text-sm font-bold mb-3">Deployment Order</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {result.plan.order.map((step, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-1"
                >
                  <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs font-medium text-blue-700">
                    {step}
                  </span>
                  {i < result.plan.order.length - 1 && (
                    <span className="text-gray-400 text-xs">→</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Rollback Plan */}
          <div className="bg-white border rounded-lg p-4">
            <h2 className="text-sm font-bold mb-2">Rollback Plan</h2>
            <div className="space-y-1">
              {result.plan.rollbackPlan.map((step, i) => (
                <div key={i} className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="text-red-400">↩</span>
                  {step}
                </div>
              ))}
            </div>
          </div>

          {/* Generated Modules */}
          <div className="bg-white border rounded-lg">
            <h2 className="text-sm font-bold p-4 border-b">Generated Modules ({result.modules.length})</h2>
            <div className="divide-y">
              {result.modules.map((mod, i) => (
                <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    mod.type === 'docker' ? 'bg-blue-100 text-blue-700' :
                    mod.type === 'kubernetes' ? 'bg-purple-100 text-purple-700' :
                    mod.type === 'terraform' ? 'bg-green-100 text-green-700' :
                    mod.type === 'cicd' ? 'bg-yellow-100 text-yellow-700' :
                    mod.type === 'monitoring' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {mod.type}
                  </span>
                  <code className="text-xs font-mono text-gray-700 flex-1">{mod.path}</code>
                  <span className="text-xs text-gray-400">{mod.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-4">
              <h2 className="text-sm font-bold text-red-700 mb-2">Errors ({result.errors.length})</h2>
              {result.errors.map((err, i) => (
                <div key={i} className="text-xs text-red-600">{err}</div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
