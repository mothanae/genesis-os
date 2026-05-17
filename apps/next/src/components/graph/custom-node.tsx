'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';

interface CustomNodeData {
  label: string;
  nodeType: string;
  description?: string;
  inputs?: Array<{ id: string; name: string; type: string }>;
  outputs?: Array<{ id: string; name: string; type: string }>;
  state?: string;
  runtime?: Record<string, unknown> | null;
}

const TYPE_COLORS: Record<string, string> = {
  service: 'bg-blue-100 border-blue-400',
  function: 'bg-purple-100 border-purple-400',
  database: 'bg-green-100 border-green-400',
  cache: 'bg-orange-100 border-orange-400',
  queue: 'bg-yellow-100 border-yellow-400',
  api_gateway: 'bg-indigo-100 border-indigo-400',
  load_balancer: 'bg-teal-100 border-teal-400',
  event_topic: 'bg-pink-100 border-pink-400',
  container: 'bg-cyan-100 border-cyan-400',
  module: 'bg-gray-100 border-gray-400',
  environment: 'bg-emerald-100 border-emerald-400',
  agent: 'bg-violet-100 border-violet-400',
  tool: 'bg-rose-100 border-rose-400',
  page: 'bg-sky-100 border-sky-400',
  component: 'bg-sky-100 border-sky-400',
};

const TYPE_ICONS: Record<string, string> = {
  service: '⚙️', function: 'λ', database: '🗄️', cache: '⚡', queue: '📨',
  api_gateway: '🔌', load_balancer: '⚖️', event_topic: '📡', container: '📦',
  module: '📁', environment: '🌍', agent: '🤖', tool: '🔧', page: '📄',
  component: '🧩', decision: '◇', flow: '🔀',
};

function CustomNode({ data, selected }: { data: CustomNodeData; selected: boolean }) {
  const colors = TYPE_COLORS[data.nodeType] ?? 'bg-gray-100 border-gray-400';
  const icon = TYPE_ICONS[data.nodeType] ?? '●';
  const hasRuntime = data.runtime !== null && data.runtime !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.05, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
      whileTap={{ scale: 0.95 }}
      className={`rounded-lg border-2 px-3 py-2 min-w-[160px] shadow-sm transition-colors ${colors} ${
        selected ? 'ring-2 ring-blue-500 shadow-md scale-105' : ''
      }`}
    >
      {/* Input port handles */}
      {data.inputs?.map((port, i) => (
        <motion.div
          key={port.id}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 + i * 0.05 }}
        >
          <Handle
            type="target"
            position={Position.Left}
            id={port.id}
            style={{ top: 20 + i * 20 }}
            className="w-2 h-2 !bg-gray-400 hover:!bg-blue-500 transition-colors"
          />
        </motion.div>
      ))}

      {(!data.inputs || data.inputs.length === 0) && (
        <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-gray-400 hover:!bg-blue-500" />
      )}

      {/* Node content */}
      <div className="flex items-center gap-2">
        <motion.span
          className="text-sm"
          animate={{ rotate: selected ? [0, -10, 10, -10, 0] : 0 }}
          transition={{ duration: 0.4 }}
        >
          {icon}
        </motion.span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{data.label}</div>
          <div className="text-xs text-gray-500">{data.nodeType}</div>
        </div>
      </div>

      {/* State indicator */}
      {data.state && (
        <div className="mt-1 flex items-center gap-1">
          <motion.span
            className={`inline-block w-2 h-2 rounded-full ${
              data.state === 'draft' ? 'bg-gray-400' :
              data.state === 'active' ? 'bg-green-500' :
              data.state === 'error' ? 'bg-red-500' : 'bg-yellow-500'
            }`}
            animate={data.state === 'active' ? { scale: [1, 1.3, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          />
          <span className="text-xs text-gray-500">{data.state}</span>
          {hasRuntime && (
            <motion.span
              className="text-xs text-blue-500 ml-1"
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            >
              ⚙
            </motion.span>
          )}
        </div>
      )}

      {/* Output port handles */}
      {data.outputs?.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: 20 + i * 20 }}
          className="w-2 h-2 !bg-gray-400 hover:!bg-green-500 transition-colors"
        />
      ))}

      {(!data.outputs || data.outputs.length === 0) && (
        <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-gray-400 hover:!bg-green-500" />
      )}
    </motion.div>
  );
}

export const CustomNodeComponent = memo(CustomNode);
