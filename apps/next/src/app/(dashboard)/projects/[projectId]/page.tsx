'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface ProjectOverview {
  graph: { nodes: number; edges: number; valid: boolean };
  agents: { total: number; active: number };
  rules: { total: number; violations: number };
  simulations: { total: number; lastRunStatus: string };
  generation: { lastGenFiles: number; lastGenLines: number };
  deployment: { lastDeployModules: number };
  evolution: { insights: number; templateMatches: number };
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [overview, setOverview] = useState<ProjectOverview | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: nodes } = await apiClient<any>(`/api/v1/projects/${projectId}/graph/nodes`);
        setOverview({
          graph: { nodes: nodes?.length ?? 0, edges: 0, valid: true },
          agents: { total: 0, active: 0 },
          rules: { total: 0, violations: 0 },
          simulations: { total: 0, lastRunStatus: 'none' },
          generation: { lastGenFiles: 0, lastGenLines: 0 },
          deployment: { lastDeployModules: 0 },
          evolution: { insights: 0, templateMatches: 0 },
        });
      } catch { /* empty project */ }
    }
    load();
  }, [projectId]);

  const layers = [
    { name: 'Graph Engine', desc: 'Visual architecture design', icon: '🔷', path: `/dashboard/projects/${projectId}/builder`, stat: `${overview?.graph.nodes ?? 0} nodes · ${overview?.graph.edges ?? 0} edges`, color: 'border-blue-400 bg-blue-50' },
    { name: 'Rule Engine', desc: 'Architecture validation & checks', icon: '🛡️', path: `/dashboard/projects/${projectId}/rules`, stat: `${overview?.rules.total ?? 0} rules · ${overview?.rules.violations ?? 0} violations`, color: 'border-amber-400 bg-amber-50' },
    { name: 'Agent Orchestration', desc: 'AI agent workflows', icon: '🤖', path: `/dashboard/projects/${projectId}/agents`, stat: `${overview?.agents.total ?? 0} agents · ${overview?.agents.active ?? 0} active`, color: 'border-purple-400 bg-purple-50' },
    { name: 'Runtime Simulation', desc: 'Simulate load, failures, scaling', icon: '📊', path: `/dashboard/projects/${projectId}/simulations`, stat: `${overview?.simulations.total ?? 0} sims · ${overview?.simulations.lastRunStatus ?? 'none'}`, color: 'border-green-400 bg-green-50' },
    { name: 'Code Generation', desc: 'Graph → production code', icon: '⚡', path: `/dashboard/projects/${projectId}/generate`, stat: `${overview?.generation.lastGenFiles ?? 0} files · ${overview?.generation.lastGenLines ?? 0} lines`, color: 'border-cyan-400 bg-cyan-50' },
    { name: 'Deployment Engine', desc: 'Docker, K8s, Terraform, CI/CD', icon: '🚀', path: `/dashboard/projects/${projectId}/deploy`, stat: `${overview?.deployment.lastDeployModules ?? 0} modules`, color: 'border-orange-400 bg-orange-50' },
    { name: 'Evolution Engine', desc: 'Insights, self-healing, patterns', icon: '🧬', path: `/dashboard/projects/${projectId}/evolve`, stat: `${overview?.evolution.insights ?? 0} insights · ${overview?.evolution.templateMatches ?? 0} templates`, color: 'border-pink-400 bg-pink-50' },
    { name: 'Version Control', desc: 'Snapshots, branches, diff', icon: '🕐', path: `/dashboard/projects/${projectId}/builder`, stat: 'Snapshots & rollback', color: 'border-gray-400 bg-gray-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Project Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          The graph is the operating system. The agents are the workforce. The runtime is the nervous system.
        </p>
      </motion.div>

      {/* Execution Loop */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Execution Loop</h2>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {['User Action', 'Graph Mutation', 'Rule Validation', 'Task Planning', 'Agent Selection', 'Execution', 'Validation', 'Simulation', 'UI Update'].map((step, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-1"
            >
              <span className="px-2 py-1 bg-gray-700 rounded text-gray-200">{step}</span>
              {i < 8 && <span className="text-gray-500">→</span>}
            </motion.div>
          ))}
        </div>
        <Link
          href={`/dashboard/projects/${projectId}/builder`}
          className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
        >
          Open Builder Canvas
        </Link>
      </div>

      {/* Layer Grid */}
      <div className="grid grid-cols-2 gap-4">
        {layers.map((layer, i) => (
          <motion.div
            key={layer.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -2 }}
          >
            <Link href={layer.path}>
              <div className={`border-2 rounded-xl p-5 ${layer.color} hover:shadow-lg transition-shadow cursor-pointer h-full`}>
                <div className="text-2xl mb-2">{layer.icon}</div>
                <h3 className="font-bold text-gray-900">{layer.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{layer.desc}</p>
                <div className="mt-3 text-xs font-medium text-gray-600 bg-white/60 inline-block px-2 py-0.5 rounded">
                  {layer.stat}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="border rounded-xl p-5 bg-white">
        <h2 className="text-sm font-bold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction label="Draw Architecture" href={`/dashboard/projects/${projectId}/builder`} />
          <QuickAction label="Validate Rules" href={`/dashboard/projects/${projectId}/rules`} />
          <QuickAction label="Generate Code" href={`/dashboard/projects/${projectId}/generate`} />
          <QuickAction label="Deploy" href={`/dashboard/projects/${projectId}/deploy`} />
          <QuickAction label="Run Simulation" href={`/dashboard/projects/${projectId}/simulations`} />
          <QuickAction label="View Insights" href={`/dashboard/projects/${projectId}/evolve`} />
          <QuickAction label="API Docs" href="http://localhost:3001/docs" />
          <QuickAction label="GraphQL" href={`/dashboard/projects/${projectId}/builder`} />
        </div>
      </div>

      {/* Graph is Source of Truth */}
      <div className="border border-gray-300 bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-600">
          <strong className="text-gray-900">The graph is the source of truth.</strong>
          {' '}Code is only a compiled artifact. Everything originates from nodes, edges, topology, relationships, flows, constraints, runtime state, and architecture intent.
        </p>
      </div>
    </div>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="text-xs text-center px-3 py-2 border rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium text-gray-700"
    >
      {label}
    </Link>
  );
}
