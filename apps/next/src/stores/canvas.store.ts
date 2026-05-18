'use client';

import { create } from 'zustand';
import type { Node, Edge, OnNodesChange, OnEdgesChange, NodeChange, EdgeChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // History stacks for undo/redo
  undoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  redoStack: Array<{ nodes: Node[]; edges: Edge[] }>;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushState: () => void;

  // Viewport
  viewport: { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  undoStack: [],
  redoStack: [],
  viewport: { x: 0, y: 0, zoom: 1 },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes: NodeChange[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as Node[],
    }));
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges) as Edge[],
    }));
  },

  addNode: (node) => {
    get().pushState();
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  addEdge: (edge) => {
    get().pushState();
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  removeNode: (nodeId) => {
    get().pushState();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }));
  },

  removeEdge: (edgeId) => {
    get().pushState();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
      selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
    }));
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    }));
  },

  pushState: () => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: [...state.nodes], edges: [...state.edges] }],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack, nodes, edges } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1]!;
    set((state) => ({
      nodes: prev.nodes,
      edges: prev.edges,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [{ nodes: [...nodes], edges: [...edges] }, ...state.redoStack].slice(0, 50),
    }));
  },

  redo: () => {
    const { redoStack, nodes, edges } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[0]!;
    set((state) => ({
      nodes: next.nodes,
      edges: next.edges,
      redoStack: state.redoStack.slice(1),
      undoStack: [...state.undoStack, { nodes: [...nodes], edges: [...edges] }].slice(-50),
    }));
  },

  setViewport: (viewport) => set({ viewport }),
}));
