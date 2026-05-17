'use client';

import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Connection,
  type Edge,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '@/stores/canvas.store';
import { CustomNodeComponent } from './custom-node';
import { apiClient } from '@/lib/api-client';

const nodeTypes = {
  custom: CustomNodeComponent,
};

function GraphCanvasInner({ projectId }: { projectId: string }) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectNode,
    selectEdge,
    setNodes,
    setEdges,
    addNode,
    addEdge: addEdgeToStore,
    pushState,
    setViewport,
  } = useCanvasStore();

  const { screenToFlowPosition } = useReactFlow();
  const dropRef = useRef<HTMLDivElement>(null);

  // Load graph from API
  useEffect(() => {
    async function loadGraph() {
      try {
        const data = await apiClient<{ nodes: unknown[]; edges: unknown[] }>(
          `/api/v1/projects/${projectId}/graph/nodes`,
        );
        if (data && Array.isArray(data.nodes)) {
          setNodes(
            (data.nodes as Array<Record<string, unknown>>).map((n) => ({
              id: n.id as string,
              type: 'custom',
              position: { x: (n.position as { x: number; y: number })?.x ?? 0, y: (n.position as { x: number; y: number })?.y ?? 0 },
              data: {
                label: n.name as string,
                nodeType: n.type as string,
                description: n.description as string,
                inputs: n.inputs as Array<{ id: string; name: string; type: string }>,
                outputs: n.outputs as Array<{ id: string; name: string; type: string }>,
                state: n.state as string,
                runtime: n.runtime as Record<string, unknown> | null,
              },
            })),
          );
        }
        if (data && Array.isArray(data.edges)) {
          setEdges(
            (data.edges as Array<Record<string, unknown>>).map((e) => ({
              id: e.id as string,
              source: e.source as string,
              target: e.target as string,
              label: e.label as string,
              animated: (e.realtime as boolean) ?? false,
              data: { type: e.type },
            })),
          );
        }
      } catch {
        // Graph may be empty — that's fine
      }
    }
    loadGraph();
  }, [projectId, setNodes, setEdges]);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      pushState();
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        animated: false,
        style: { stroke: '#6b7280', strokeWidth: 2 },
      };
      const edges = addEdge(newEdge, useCanvasStore.getState().edges);
      addEdgeToStore(newEdge);
    },
    [pushState, addEdgeToStore],
  );

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  // Handle edge click
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      selectEdge(edge.id);
    },
    [selectEdge],
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Handle viewport change
  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  // Drag-and-drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/genesis-node-type');
      const name = event.dataTransfer.getData('application/genesis-node-name');
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = `node-${Date.now()}`;
      const newNode = {
        id,
        type: 'custom',
        position,
        data: {
          label: name || `${type}_${id.slice(-4)}`,
          nodeType: type,
          inputs: [],
          outputs: [],
          state: 'draft',
        },
      };
      addNode(newNode);
    },
    [screenToFlowPosition, addNode],
  );

  return (
    <div ref={dropRef} className="w-full h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d1d5db" />
        <Controls className="rounded-lg shadow-md border" />
        <MiniMap
          className="rounded-lg shadow-md border"
          nodeColor={(node) => {
            const type = (node.data as { nodeType?: string })?.nodeType ?? '';
            const colorMap: Record<string, string> = {
              service: '#3b82f6',
              database: '#22c55e',
              cache: '#f97316',
              queue: '#eab308',
              api_gateway: '#6366f1',
              agent: '#8b5cf6',
            };
            return colorMap[type] ?? '#9ca3af';
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}

export function GraphCanvas({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner projectId={projectId} />
    </ReactFlowProvider>
  );
}
