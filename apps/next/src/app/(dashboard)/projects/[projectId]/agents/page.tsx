'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Agent {
  id: string;
  name: string;
  type: string;
  description: string;
  capabilities: string[];
}

export default function AgentsPage() {
  const { projectId } = useParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadAgents();
  }, [projectId]);

  async function loadAgents() {
    setLoading(true);
    try {
      const data = await apiClient<Agent[]>(`/api/v1/projects/${projectId}/agents`);
      setAgents(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function importDefaultAgents() {
    setImporting(true);
    try {
      const defaults = getDefaultAgents();
      const created: Agent[] = [];
      for (const agent of defaults) {
        try {
          const result = await apiClient<Agent>(`/api/v1/projects/${projectId}/agents`, {
            method: 'POST',
            body: {
              name: agent.name,
              description: agent.description,
              graphDefinition: {
                nodes: [{ id: 'entry', type: 'input', label: 'Start', config: {} }],
                edges: [],
              },
              toolsConfig: [],
              modelConfig: { temperature: 0.7 },
            },
          });
          created.push(result);
        } catch { /* skip duplicates */ }
      }
      setAgents((prev) => [...prev, ...created]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const agentEmojis: Record<string, string> = {
    plan: '🧠',
    generate_frontend: '🎨',
    generate_backend: '⚙️',
    generate_api: '🔌',
    generate_database: '🗄️',
    generate_infra: '🏗️',
    validate: '✅',
    simulate: '📊',
    deploy: '🚀',
    document: '📝',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Orchestration</h1>
          <p className="text-sm text-gray-500 mt-1">Project: {projectId as string}</p>
        </div>
        {agents.length === 0 && (
          <button
            onClick={importDefaultAgents}
            disabled={importing}
            className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Default Agents'}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 mt-6">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading agents...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && agents.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="border rounded-lg p-4 hover:shadow-md transition group"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{agentEmojis[agent.type] ?? '🤖'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{agent.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{agent.description}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(agent.capabilities ?? []).map((cap) => (
                      <span
                        key={cap}
                        className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                      >
                        {cap.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition">
                  Execute &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="mt-12 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-500 text-sm mb-4">No agents configured for this project.</p>
          <p className="text-gray-400 text-xs">
            Click "Import Default Agents" to add standard architecture agents (planner, frontend, backend, database, API, infra, validation, simulation, deployment, documentation).
          </p>
        </div>
      )}
    </div>
  );
}

function getDefaultAgents(): Agent[] {
  return [
    { id: 'planner-agent', name: 'Architecture Planner', type: 'plan', description: 'Analyzes graph topology and creates task execution plans', capabilities: ['graph_analysis', 'task_planning', 'dependency_resolution'] },
    { id: 'frontend-agent', name: 'Frontend Generator', type: 'generate_frontend', description: 'Generates React/Next.js frontend code from graph specs', capabilities: ['react_generation', 'component_generation', 'routing'] },
    { id: 'backend-agent', name: 'Backend Generator', type: 'generate_backend', description: 'Generates Node.js/Fastify backend code from graph specs', capabilities: ['api_generation', 'service_generation', 'middleware'] },
    { id: 'api-agent', name: 'API Generator', type: 'generate_api', description: 'Generates REST/GraphQL/gRPC API definitions', capabilities: ['rest_generation', 'graphql_generation', 'openapi'] },
    { id: 'database-agent', name: 'Database Generator', type: 'generate_database', description: 'Generates database schemas and migrations', capabilities: ['schema_generation', 'migration_generation'] },
    { id: 'infra-agent', name: 'Infrastructure Generator', type: 'generate_infra', description: 'Generates Docker, K8s, and Terraform configs', capabilities: ['docker_generation', 'kubernetes_generation', 'terraform_generation'] },
    { id: 'validate-agent', name: 'Architecture Validator', type: 'validate', description: 'Validates code against graph topology and rules', capabilities: ['topology_validation', 'rule_evaluation', 'security_check'] },
    { id: 'simulate-agent', name: 'Runtime Simulator', type: 'simulate', description: 'Simulates generated systems before deployment', capabilities: ['load_testing', 'failure_simulation', 'latency_analysis'] },
    { id: 'deploy-agent', name: 'Deployment Agent', type: 'deploy', description: 'Orchestrates deployment to target environments', capabilities: ['deployment', 'rollback', 'health_check'] },
    { id: 'document-agent', name: 'Documentation Generator', type: 'document', description: 'Generates architecture and API documentation', capabilities: ['architecture_docs', 'api_docs', 'runbook_generation'] },
  ];
}
