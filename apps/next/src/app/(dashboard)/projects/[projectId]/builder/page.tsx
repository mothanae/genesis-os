'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { GraphCanvas } from '@/components/graph/graph-canvas';
import { NodePalette } from '@/components/graph/node-palette';
import { NodeInspector } from '@/components/graph/node-inspector';
import { useCanvasStore } from '@/stores/canvas.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useExecutionLoop } from '@/hooks/use-execution-loop';
import { apiClient } from '@/lib/api-client';

export default function BuilderPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { undo, redo, undoStack, redoStack, nodes, edges, addNode, removeNode, removeEdge } =
    useCanvasStore();
  const [syncStatus, setSyncStatus] = useState<string>('connected');
  const { status: execStatus, loading: execLoading, execute: runExecutionLoop } = useExecutionLoop(projectId);

  // WebSocket for real-time canvas sync
  const { send } = useWebSocket({
    projectId,
    onGraphMutation: (payload) => {
      // Handle remote graph mutations
      const action = payload.type as string;
      if (action === 'graph_mutation') {
        const data = payload.payload as Record<string, unknown>;
        if (data.action === 'add_node' && data.node) {
          addNode(data.node as Parameters<typeof addNode>[0]);
        }
      }
      setSyncStatus('synced');
    },
  });

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useCanvasStore.getState();
        if (state.selectedNodeId) removeNode(state.selectedNodeId);
        if (state.selectedEdgeId) removeEdge(state.selectedEdgeId);
      }
    },
    [undo, redo, removeNode, removeEdge],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Execution Loop Toolbar */}
      <div className="h-10 bg-gray-900 text-white flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Genesis Builder</span>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${syncStatus === 'connected' ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {syncStatus}
          </span>
          <span className="text-gray-500">|</span>
          <span>{nodes.length} nodes / {edges.length} edges</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runExecutionLoop}
            disabled={execLoading}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
          >
            {execLoading ? 'Running...' : 'Run Execution Loop'}
          </button>
          <button
            onClick={async () => {
              try {
                const state = useCanvasStore.getState();
                for (const node of state.nodes) {
                  await apiClient(`/api/v1/projects/${projectId}/graph/nodes`, {
                    method: 'POST',
                    body: {
                      type: node.data?.nodeType ?? 'service',
                      name: node.data?.label ?? 'Untitled',
                      position: { x: node.position.x, y: node.position.y },
                    },
                  });
                }
                setSyncStatus('saved');
              } catch { setSyncStatus('error'); }
            }}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white"
          >
            Save Graph
          </button>
        </div>
      </div>

      {/* Execution Status */}
      {execStatus && (
        <div className="h-8 bg-blue-50 border-b border-blue-200 flex items-center px-4 text-xs gap-4 overflow-x-auto">
          <span className="font-semibold text-blue-700">Execution Loop:</span>
          <span>Topology: {execStatus.topology.valid ? '✅' : '❌'}</span>
          <span>Plan: {execStatus.plan.taskCount} tasks</span>
          <span>Execution: {execStatus.execution.filter((e) => e.status === 'completed').length}/{execStatus.execution.length}</span>
          <span>Gen: {execStatus.generation.files} files</span>
          <span>Deploy: {execStatus.deployment.modules} modules</span>
          <span>Insights: {execStatus.evolution.insights}</span>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <div className="flex-1 relative">
          <GraphCanvas projectId={projectId} />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <button onClick={undo} disabled={undoStack.length === 0}
              className="px-2 py-1 text-xs bg-white border rounded shadow-sm hover:bg-gray-50 disabled:opacity-30">↩ Undo</button>
            <button onClick={redo} disabled={redoStack.length === 0}
              className="px-2 py-1 text-xs bg-white border rounded shadow-sm hover:bg-gray-50 disabled:opacity-30">↪ Redo</button>
          </div>
        </div>
        <NodeInspector projectId={projectId} />
      </div>
    </div>
  );
}
