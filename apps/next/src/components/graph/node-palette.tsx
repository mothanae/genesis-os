'use client';

import { useState } from 'react';

interface PaletteCategory {
  name: string;
  nodes: Array<{ type: string; label: string; icon: string }>;
}

const PALETTE: PaletteCategory[] = [
  {
    name: 'Application',
    nodes: [
      { type: 'service', label: 'Service', icon: '⚙️' },
      { type: 'function', label: 'Function', icon: 'λ' },
      { type: 'container', label: 'Container', icon: '📦' },
      { type: 'pod', label: 'Pod', icon: '⬜' },
    ],
  },
  {
    name: 'Data',
    nodes: [
      { type: 'database', label: 'Database', icon: '🗄️' },
      { type: 'cache', label: 'Cache', icon: '⚡' },
      { type: 'queue', label: 'Queue', icon: '📨' },
      { type: 'event_store', label: 'Event Store', icon: '📚' },
      { type: 'object_store', label: 'Object Store', icon: '💾' },
    ],
  },
  {
    name: 'Network',
    nodes: [
      { type: 'api_gateway', label: 'API Gateway', icon: '🔌' },
      { type: 'load_balancer', label: 'Load Balancer', icon: '⚖️' },
      { type: 'cdn', label: 'CDN', icon: '🌐' },
      { type: 'dns', label: 'DNS', icon: '📋' },
      { type: 'proxy', label: 'Proxy', icon: '🔄' },
      { type: 'firewall', label: 'Firewall', icon: '🛡️' },
    ],
  },
  {
    name: 'Events & Integration',
    nodes: [
      { type: 'event_topic', label: 'Event Topic', icon: '📡' },
      { type: 'event_subscription', label: 'Subscription', icon: '📥' },
      { type: 'rest_endpoint', label: 'REST Endpoint', icon: '🔗' },
      { type: 'graphql_schema', label: 'GraphQL Schema', icon: '◈' },
      { type: 'grpc_service', label: 'gRPC Service', icon: '⚡' },
      { type: 'webhook', label: 'Webhook', icon: '🪝' },
    ],
  },
  {
    name: 'Infrastructure',
    nodes: [
      { type: 'environment', label: 'Environment', icon: '🌍' },
      { type: 'region', label: 'Region', icon: '📍' },
      { type: 'cluster', label: 'Cluster', icon: '🖥️' },
      { type: 'namespace', label: 'Namespace', icon: '📂' },
    ],
  },
  {
    name: 'AI & Agents',
    nodes: [
      { type: 'agent', label: 'AI Agent', icon: '🤖' },
      { type: 'tool', label: 'Tool', icon: '🔧' },
      { type: 'prompt_template', label: 'Prompt', icon: '💬' },
      { type: 'vector_store', label: 'Vector Store', icon: '🧠' },
    ],
  },
  {
    name: 'UI',
    nodes: [
      { type: 'page', label: 'Page', icon: '📄' },
      { type: 'component', label: 'Component', icon: '🧩' },
      { type: 'form', label: 'Form', icon: '📝' },
      { type: 'table', label: 'Table', icon: '📊' },
      { type: 'chart', label: 'Chart', icon: '📈' },
    ],
  },
  {
    name: 'Flow',
    nodes: [
      { type: 'flow', label: 'Flow', icon: '🔀' },
      { type: 'decision', label: 'Decision', icon: '◇' },
      { type: 'parallel', label: 'Parallel', icon: '⫼' },
      { type: 'wait', label: 'Wait', icon: '⏳' },
      { type: 'subprocess', label: 'Subprocess', icon: '📦' },
      { type: 'human_task', label: 'Human Task', icon: '👤' },
    ],
  },
];

export function NodePalette() {
  const [expandedCategory, setExpandedCategory] = useState<string>('Application');

  function onDragStart(event: React.DragEvent, type: string, label: string) {
    event.dataTransfer.setData('application/genesis-node-type', type);
    event.dataTransfer.setData('application/genesis-node-name', label);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="w-56 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-700">Node Palette</h2>
        <p className="text-xs text-gray-400">Drag onto the canvas</p>
      </div>
      {PALETTE.map((category) => (
        <div key={category.name}>
          <button
            onClick={() =>
              setExpandedCategory(expandedCategory === category.name ? '' : category.name)
            }
            className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 flex justify-between items-center"
          >
            {category.name}
            <span className="text-gray-400">
              {expandedCategory === category.name ? '▾' : '▸'}
            </span>
          </button>
          {expandedCategory === category.name && (
            <div className="px-2 pb-2 space-y-1">
              {category.nodes.map((node) => (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type, node.label)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-grab hover:bg-gray-100 active:cursor-grabbing border border-transparent hover:border-gray-300 transition-colors"
                >
                  <span>{node.icon}</span>
                  <span className="text-xs text-gray-700">{node.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
