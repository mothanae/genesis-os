'use client';

import { useCanvasStore } from '@/stores/canvas.store';
import { useCallback } from 'react';

export function NodeInspector({ projectId }: { projectId: string }) {
  const { nodes, selectedNodeId, selectedEdgeId, selectNode, updateNodeData, removeNode } =
    useCanvasStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const data = selectedNode?.data as Record<string, unknown> | undefined;

  const handleFieldChange = useCallback(
    (field: string, value: unknown) => {
      if (selectedNodeId) {
        updateNodeData(selectedNodeId, { [field]: value });
      }
    },
    [selectedNodeId, updateNodeData],
  );

  if (!selectedNode) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 h-full p-4">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <span className="text-4xl mb-3">👆</span>
          <h3 className="text-sm font-semibold text-gray-700">Select a Node</h3>
          <p className="text-xs text-gray-400 mt-1">
            Click any node on the canvas to inspect and edit its properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-l border-gray-200 h-full overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 truncate">{data?.label as string}</h2>
          <button
            onClick={() => selectNode(null)}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
          {data?.nodeType as string}
        </span>
      </div>

      {/* Fields */}
      <div className="p-3 space-y-3">
        {/* Name */}
        <FieldRow label="Name">
          <input
            type="text"
            value={(data?.label as string) ?? ''}
            onChange={(e) => handleFieldChange('label', e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </FieldRow>

        {/* Description */}
        <FieldRow label="Description">
          <textarea
            value={(data?.description as string) ?? ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            rows={2}
            className="w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </FieldRow>

        {/* State */}
        <FieldRow label="State">
          <select
            value={(data?.state as string) ?? 'draft'}
            onChange={(e) => handleFieldChange('state', e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="deprecated">Deprecated</option>
            <option value="error">Error</option>
          </select>
        </FieldRow>

        {/* Position */}
        <FieldRow label="Position">
          <div className="grid grid-cols-2 gap-1">
            <div>
              <span className="text-[10px] text-gray-400">X</span>
              <input
                type="number"
                value={Math.round(selectedNode.position.x)}
                readOnly
                className="w-full text-xs border rounded px-2 py-1 bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Y</span>
              <input
                type="number"
                value={Math.round(selectedNode.position.y)}
                readOnly
                className="w-full text-xs border rounded px-2 py-1 bg-gray-50 text-gray-500"
              />
            </div>
          </div>
        </FieldRow>

        {/* Ports */}
        {data?.inputs && (data.inputs as unknown[]).length > 0 && (
          <FieldRow label={`Input Ports (${(data.inputs as unknown[]).length})`}>
            <ul className="text-xs space-y-1">
              {(data.inputs as Array<{ id: string; name: string; type: string }>).map((port) => (
                <li key={port.id} className="text-gray-600">
                  ▸ {port.name}{' '}
                  <span className="text-gray-400">({port.type})</span>
                </li>
              ))}
            </ul>
          </FieldRow>
        )}

        {data?.outputs && (data.outputs as unknown[]).length > 0 && (
          <FieldRow label={`Output Ports (${(data.outputs as unknown[]).length})`}>
            <ul className="text-xs space-y-1">
              {(data.outputs as Array<{ id: string; name: string; type: string }>).map((port) => (
                <li key={port.id} className="text-gray-600">
                  ▸ {port.name}{' '}
                  <span className="text-gray-400">({port.type})</span>
                </li>
              ))}
            </ul>
          </FieldRow>
        )}

        {/* Runtime Config */}
        {data?.runtime && (
          <FieldRow label="Runtime">
            <pre className="text-[10px] bg-gray-50 rounded p-2 overflow-x-auto">
              {JSON.stringify(data.runtime, null, 2)}
            </pre>
          </FieldRow>
        )}

        {/* Delete button */}
        <button
          onClick={() => {
            if (confirm('Delete this node?')) {
              removeNode(selectedNode.id);
            }
          }}
          className="w-full py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
