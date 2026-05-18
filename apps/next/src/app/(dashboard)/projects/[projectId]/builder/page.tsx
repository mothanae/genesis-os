'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import { GraphCanvas } from '@/components/graph/graph-canvas';
import { NodePalette } from '@/components/graph/node-palette';
import { NodeInspector } from '@/components/graph/node-inspector';
import { useCanvasStore } from '@/stores/canvas.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useExecutionLoop } from '@/hooks/use-execution-loop';
import { apiClient } from '@/lib/api-client';

interface ValidationState {
  valid: boolean;
  errors: Array<{ code: string; message: string; nodeId?: string; edgeId?: string }>;
  warnings: Array<{ code: string; message: string; nodeId?: string; edgeId?: string }>;
  suggestions: Array<{ system: string; reason: string; autoFix?: boolean }>;
}

interface InferenceResult {
  system: string;
  reason: string;
  confidence: number;
  suggestedNodes: Array<{ type: string; name: string; description: string }>;
}

const AUTO_SAVE_DEBOUNCE_MS = 3000;

async function saveGraph(projectId: string): Promise<boolean> {
  try {
    const state = useCanvasStore.getState();
    const result = await apiClient<{
      nodesCreated: number; nodesUpdated: number;
      edgesCreated: number; edgesUpdated: number;
      errors: string[];
    }>(`/api/v1/projects/${projectId}/graph/batch`, {
      method: 'POST',
      body: {
        nodes: state.nodes.map((n) => ({
          id: n.id,
          nodeType: n.data?.nodeType ?? 'service',
          label: n.data?.label ?? 'Untitled',
          description: n.data?.description,
          positionX: n.position.x,
          positionY: n.position.y,
          properties: n.data?.properties,
        })),
        edges: state.edges.map((e) => ({
          id: e.id,
          sourceNodeId: e.source,
          targetNodeId: e.target,
          edgeType: e.data?.type ?? 'depends_on',
          label: e.label ?? e.data?.label,
        })),
      },
    });
    return !result.errors?.length;
  } catch {
    return false;
  }
}

async function fetchValidation(projectId: string): Promise<ValidationState | null> {
  try {
    return await apiClient<ValidationState>(
      `/api/v1/projects/${projectId}/graph/validate`,
    );
  } catch {
    return null;
  }
}

export default function BuilderPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { undo, redo, undoStack, redoStack, nodes, edges, addNode, removeNode, removeEdge, setNodes, setEdges, updateNodeData } =
    useCanvasStore();
  const [syncStatus, setSyncStatus] = useState<string>('connected');
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [inference, setInference] = useState<InferenceResult[]>([]);
  const [showInference, setShowInference] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSavedRef = useRef<string>('');

  const { status: execStatus, loading: execLoading, execute: runExecutionLoop } = useExecutionLoop(projectId);

  // WebSocket for real-time canvas sync
  const { send } = useWebSocket({
    projectId,
    onGraphMutation: (payload) => {
      const msgType = payload.type as string;
      if (msgType === 'graph_mutation') {
        const data = payload.payload as Record<string, unknown>;
        const action = data.action as string;
        switch (action) {
          case 'add_node':
            if (data.node) addNode(data.node as Parameters<typeof addNode>[0]);
            break;
          case 'remove_node': {
            const nodeId = data.nodeId as string;
            if (nodeId) removeNode(nodeId);
            break;
          }
          case 'update_node': {
            const nodeId = data.nodeId as string;
            const nodeData = data.data as Record<string, unknown>;
            if (nodeId && nodeData) updateNodeData(nodeId, nodeData);
            break;
          }
          case 'add_edge':
            if (data.edge) {
              const state = useCanvasStore.getState();
              setEdges([...state.edges, data.edge as Edge]);
            }
            break;
          case 'remove_edge': {
            const edgeId = data.edgeId as string;
            if (edgeId) removeEdge(edgeId);
            break;
          }
          case 'batch_sync': {
            if (Array.isArray(data.nodes)) setNodes(data.nodes as Parameters<typeof setNodes>[0]);
            if (Array.isArray(data.edges)) setEdges(data.edges as Parameters<typeof setEdges>[0]);
            break;
          }
          default:
            break;
        }
        setSyncStatus('synced');
      }
    },
  });

  // Auto-save: debounced persistence after changes
  useEffect(() => {
    const stateKey = JSON.stringify({ n: nodes.length, e: edges.length });
    if (stateKey === lastSavedRef.current) return;
    if (nodes.length === 0 && edges.length === 0) return; // Don't auto-save empty canvas on mount

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSyncStatus('unsaved');

    autoSaveTimer.current = setTimeout(async () => {
      const ok = await saveGraph(projectId);
      setSyncStatus(ok ? 'saved' : 'error');
      if (ok) {
        lastSavedRef.current = stateKey;
        send('graph_mutation', { action: 'batch_sync', nodes, edges });
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [nodes.length, edges.length, projectId, send]);

  // Fetch validation on mount and after saves
  useEffect(() => {
    fetchValidation(projectId).then((v) => { if (v) setValidation(v); });
  }, [projectId, syncStatus === 'saved' ? 1 : 0]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (isCtrl && e.key === 's') { e.preventDefault(); saveGraph(projectId).then((ok) => setSyncStatus(ok ? 'saved' : 'error')); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useCanvasStore.getState();
        if (state.selectedNodeId) removeNode(state.selectedNodeId);
        if (state.selectedEdgeId) removeEdge(state.selectedEdgeId);
      }
    },
    [undo, redo, removeNode, removeEdge, projectId],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleMutation = useCallback((action: string, payload: Record<string, unknown>) => {
    send('graph_mutation', { action, ...payload });

    // Run connection inference when a new edge is added
    if (action === 'add_edge') {
      const edge = payload.edge as Edge | undefined;
      if (edge) {
        const state = useCanvasStore.getState();
        const sourceNode = state.nodes.find((n) => n.id === edge.source);
        const targetNode = state.nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          apiClient<InferenceResult[]>(`/api/v1/projects/${projectId}/graph/infer-connection`, {
            method: 'POST',
            body: {
              sourceType: (sourceNode.data as Record<string, unknown>)?.nodeType as string ?? 'service',
              targetType: (targetNode.data as Record<string, unknown>)?.nodeType as string ?? 'service',
              edgeType: (edge.data as Record<string, unknown>)?.type as string ?? 'depends_on',
            },
          }).then((results) => {
            if (results && results.length > 0) {
              setInference(results);
              setShowInference(true);
              setTimeout(() => setShowInference(false), 10000);
            }
          }).catch(() => { /* inference is optional */ });
        }
      }
    }
  }, [send, projectId]);

  // Status indicator
  const statusColor =
    syncStatus === 'saved' || syncStatus === 'synced' ? 'bg-green-400' :
    syncStatus === 'unsaved' ? 'bg-yellow-400' :
    syncStatus === 'error' ? 'bg-red-400' : 'bg-green-400';

  const validationBadge =
    !validation ? '' :
    validation.errors?.length > 0 ? 'text-red-500' :
    validation.warnings?.length > 0 ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="h-10 bg-gray-900 text-white flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Genesis Builder</span>

          {/* Sync status */}
          <button
            onClick={async () => {
              const ok = await saveGraph(projectId);
              setSyncStatus(ok ? 'saved' : 'error');
              if (ok) send('graph_mutation', { action: 'batch_sync', nodes, edges });
            }}
            className="flex items-center gap-1 hover:underline"
          >
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            {syncStatus}
          </button>

          <span className="text-gray-500">|</span>
          <span>{nodes.length} nodes / {edges.length} edges</span>

          {/* Validation badge */}
          {validation && (
            <>
              <span className="text-gray-500">|</span>
              <button
                onClick={() => setShowValidation(!showValidation)}
                className={`flex items-center gap-1 hover:underline ${validationBadge}`}
              >
                {validation.errors?.length > 0
                  ? `❌ ${validation.errors.length} errors`
                  : validation.warnings?.length > 0
                  ? `⚠ ${validation.warnings.length} warnings`
                  : '✅ Valid'}
              </button>
            </>
          )}
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
              const ok = await saveGraph(projectId);
              setSyncStatus(ok ? 'saved' : 'error');
              if (ok) send('graph_mutation', { action: 'batch_sync', nodes, edges });
            }}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white"
          >
            Save
          </button>
        </div>
      </div>

      {/* Validation panel (collapsible) */}
      {showValidation && validation && (
        <div className="bg-gray-50 border-b text-xs max-h-48 overflow-y-auto">
          <div className="p-3 space-y-2">
            {/* Errors */}
            {validation.errors?.map((err, i) => (
              <div key={`err-${i}`} className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                <span className="font-semibold shrink-0">❌ {err.code}</span>
                <span>{err.message}</span>
                {err.nodeId && <span className="text-red-400 ml-auto">node: {err.nodeId.slice(0, 8)}</span>}
              </div>
            ))}
            {/* Warnings */}
            {validation.warnings?.map((w, i) => (
              <div key={`warn-${i}`} className="flex items-start gap-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                <span className="font-semibold shrink-0">⚠ {w.code}</span>
                <span>{w.message}</span>
                {w.nodeId && <span className="text-yellow-400 ml-auto">node: {w.nodeId.slice(0, 8)}</span>}
              </div>
            ))}
            {/* Suggestions */}
            {validation.suggestions?.map((s, i) => (
              <div key={`sug-${i}`} className="flex items-start gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                <span className="font-semibold shrink-0">💡 {s.system}</span>
                <span>{s.reason}</span>
                {s.autoFix && <span className="text-blue-400 ml-auto">auto-fix available</span>}
              </div>
            ))}
            {!validation.errors?.length && !validation.warnings?.length && !validation.suggestions?.length && (
              <div className="text-green-600 px-2 py-1">All checks passed. No issues found.</div>
            )}
          </div>
        </div>
      )}

      {/* Inference toast */}
      {showInference && inference.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-200 p-3 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-indigo-700">Inferred subsystems from this connection:</span>
            <button onClick={() => setShowInference(false)} className="text-indigo-400 hover:text-indigo-600">✕</button>
          </div>
          <div className="space-y-1">
            {inference.map((inf, i) => (
              <div key={i} className="flex items-center gap-2 text-indigo-700">
                <span className="font-medium">{inf.system}</span>
                <span className="text-indigo-400">{(inf.confidence * 100).toFixed(0)}% confidence</span>
                <span className="text-indigo-500">— {inf.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Status */}
      {execStatus && (
        <div className="h-8 bg-blue-50 border-b border-blue-200 flex items-center px-4 text-xs gap-4 overflow-x-auto">
          <span className="font-semibold text-blue-700">Execution:</span>
          <span>Topology: {execStatus.topology.valid ? '✅' : '❌'}</span>
          <span>Plan: {execStatus.plan.taskCount} tasks</span>
          <span>Steps: {execStatus.execution.filter((e: { status: string }) => e.status === 'completed').length}/{execStatus.execution.length}</span>
          <span>Gen: {execStatus.generation.files} files</span>
          <span>Deploy: {execStatus.deployment.modules} modules</span>
          <span>Insights: {execStatus.evolution.insights}</span>
          {execStatus.generation.files > 0 && (
            <a href={`/dashboard/projects/${projectId}/generate`} className="ml-auto text-blue-600 hover:underline font-medium">
              View Generated Code →
            </a>
          )}
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <div className="flex-1 relative">
          <GraphCanvas
            projectId={projectId}
            onMutation={handleMutation}
          />
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
