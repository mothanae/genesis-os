'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

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
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [proj, nodes, edges, validation, agents, rules, violations] = await Promise.all([
          apiClient<ProjectInfo>(`/api/v1/projects/${projectId}`).catch(() => null),
          apiClient<unknown[]>(`/api/v1/projects/${projectId}/graph/nodes`).catch(() => []),
          apiClient<unknown[]>(`/api/v1/projects/${projectId}/graph/edges`).catch(() => []),
          apiClient<{ valid: boolean }>(`/api/v1/projects/${projectId}/graph/validate`).catch(() => ({ valid: true, errors: [], warnings: [] })),
          apiClient<unknown[]>(`/api/v1/projects/${projectId}/agents`).catch(() => []),
          apiClient<unknown[]>(`/api/v1/projects/${projectId}/rules`).catch(() => []),
          apiClient<unknown[]>(`/api/v1/projects/${projectId}/rules/violations`).catch(() => []),
        ]);

        if (proj) {
          setProject(proj);
          setEditName(proj.name);
          setEditDesc(proj.description ?? '');
        }

        setOverview({
          graph: {
            nodes: Array.isArray(nodes) ? nodes.length : 0,
            edges: Array.isArray(edges) ? edges.length : 0,
            valid: (validation as { valid?: boolean })?.valid ?? true,
          },
          agents: {
            total: Array.isArray(agents) ? agents.length : 0,
            active: 0,
          },
          rules: {
            total: Array.isArray(rules) ? rules.length : 0,
            violations: Array.isArray(violations) ? violations.filter((v: unknown) => !(v as { resolvedAt?: string })?.resolvedAt).length : 0,
          },
          simulations: { total: 0, lastRunStatus: 'none' },
          generation: { lastGenFiles: 0, lastGenLines: 0 },
          deployment: { lastDeployModules: 0 },
          evolution: { insights: 0, templateMatches: 0 },
        });
      } catch { /* empty project */ }
    }
    load();
  }, [projectId]);

  async function saveProject() {
    try {
      await apiClient(`/api/v1/projects/${projectId}`, {
        method: 'PATCH',
        body: { name: editName, description: editDesc },
      });
      setProject((p) => p ? { ...p, name: editName, description: editDesc } : null);
      setEditing(false);
    } catch { /* ignore */ }
  }

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
        {project && (
          <div className="mb-4">
            {editing ? (
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="text-3xl font-bold w-full border rounded px-3 py-1 bg-white" />
                  <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                    className="text-sm text-gray-500 w-full border rounded px-3 py-1 bg-white" placeholder="Project description" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveProject} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Save</button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1 border rounded text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="group cursor-pointer" onClick={() => setEditing(true)}>
                <h1 className="text-3xl font-bold group-hover:text-blue-600 transition">
                  {project.name}
                  <span className="text-xs text-gray-300 ml-2 opacity-0 group-hover:opacity-100">✏️</span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {project.description ?? 'The graph is the operating system. The agents are the workforce. The runtime is the nervous system.'}
                </p>
              </div>
            )}
          </div>
        )}
        {!project && (
          <>
            <h1 className="text-3xl font-bold">Project Overview</h1>
            <p className="text-sm text-gray-500 mt-1">
              The graph is the operating system. The agents are the workforce. The runtime is the nervous system.
            </p>
          </>
        )}
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
