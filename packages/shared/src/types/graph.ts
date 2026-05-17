// ── Port Contract ──────────────────────────────────────────────────

export interface Port {
  id: string;
  name: string;
  type: 'data' | 'event' | 'trigger' | 'config' | 'reference' | 'stream';
  direction: 'input' | 'output';
  schema?: Record<string, unknown>;
  required?: boolean;
  defaultValue?: unknown;
}

// ── Runtime & Deployment ──────────────────────────────────────────

export interface RuntimeConfig {
  replicas?: number;
  memory?: string;
  cpu?: string;
  timeout?: number;
  env?: Record<string, string>;
  scaling?: {
    min: number;
    max: number;
    targetCpuPercent?: number;
    targetMemoryPercent?: number;
  };
  healthCheck?: {
    path?: string;
    port?: number;
    intervalSeconds?: number;
    timeoutSeconds?: number;
  };
}

export interface DeploymentConfig {
  provider?: 'docker' | 'kubernetes' | 'terraform' | 'serverless';
  region?: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  strategy?: 'rolling' | 'recreate' | 'blue-green' | 'canary';
  rollbackEnabled?: boolean;
}

// ── Node Taxonomy ──────────────────────────────────────────────────

export const NODE_TYPES = [
  // Application
  'service',
  'function',
  'container',
  'pod',
  // Data
  'database',
  'cache',
  'queue',
  'event_store',
  'object_store',
  // Network
  'load_balancer',
  'cdn',
  'dns',
  'api_gateway',
  'proxy',
  'firewall',
  // Integration
  'rest_endpoint',
  'graphql_schema',
  'grpc_service',
  'event_topic',
  'event_subscription',
  'webhook',
  // Infrastructure
  'environment',
  'region',
  'cluster',
  'namespace',
  'instance',
  // Logical
  'module',
  'library',
  'package',
  'bounded_context',
  'aggregate_root',
  'domain_event',
  // Flow
  'flow',
  'decision',
  'parallel',
  'wait',
  'subprocess',
  'human_task',
  // AI
  'agent',
  'tool',
  'prompt_template',
  'vector_store',
  'embedding',
  // UI
  'page',
  'component',
  'form',
  'table',
  'chart',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  // Structural
  'depends_on',
  'contains',
  'implements',
  'extends',
  // Communication
  'communicates_with',
  'routes_to',
  'proxies_to',
  // Data flow
  'reads_from',
  'writes_to',
  'consumes_from',
  'produces_to',
  'streams_to',
  // Events
  'triggers',
  'emits',
  'subscribes_to',
  // Deployment
  'deployed_to',
  'hosted_on',
  'configured_by',
  // Flow
  'flows_to',
  'branches_to',
  'merges_from',
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

// ── Core Graph Contracts ───────────────────────────────────────────

export interface GraphNode {
  id: string;
  projectId: string;
  type: NodeType;
  subtype?: string;
  name: string;
  description?: string | null;
  metadata: Record<string, unknown>;
  position: {
    x: number;
    y: number;
  };
  inputs: Port[];
  outputs: Port[];
  dependencies: string[];
  relationships: string[];
  runtime?: RuntimeConfig | null;
  deployment?: DeploymentConfig | null;
  state: string;
  version: number;
  parentId?: string | null;
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  projectId: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string | null;
  metadata?: Record<string, unknown>;
  realtime?: boolean;
  bidirectional?: boolean;
  weight?: number;
  properties?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ── Graph Branching ────────────────────────────────────────────────

export interface GraphBranch {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  parentBranchId?: string | null;
  baseSnapshotId?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GraphSnapshot {
  id: string;
  projectId: string;
  branchId?: string | null;
  label: string;
  description?: string | null;
  nodeCount: number;
  edgeCount: number;
  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  parentSnapshotId?: string | null;
  createdAt: string;
}

// ── Analysis Types ─────────────────────────────────────────────────

export interface CycleResult {
  path: string[];
  nodeIds: string[];
  edgeIds: string[];
  length: number;
}

export interface ImpactAnalysisResult {
  nodeId: string;
  affectedNodes: string[];
  affectedEdges: string[];
  depth: number;
  totalAffected: number;
  cascadingFailures?: string[][];
}

export interface DependencyChain {
  nodeId: string;
  direction: 'upstream' | 'downstream';
  chain: Array<{
    nodeId: string;
    nodeName: string;
    depth: number;
    edgeType: EdgeType;
  }>;
}

export interface GraphDiff {
  addedNodes: GraphNode[];
  removedNodes: GraphNode[];
  modifiedNodes: GraphNode[];
  addedEdges: GraphEdge[];
  removedEdges: GraphEdge[];
  modifiedEdges: GraphEdge[];
}

export interface TopologyValidation {
  valid: boolean;
  errors: GraphValidationError[];
  warnings: GraphValidationWarning[];
  suggestions: GraphSuggestion[];
  inferredSubsystems?: Array<{
    system: string;
    reason: string;
    suggestedNodes: Array<{ type: string; name: string; description: string }>;
    suggestedEdges: Array<{ source: string; target: string; type: string; label: string }>;
    confidence: number;
  }>;
}

export interface GraphValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: 'error';
}

export interface GraphValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: 'warning';
}

export interface GraphSuggestion {
  code: string;
  message: string;
  suggestion: string;
  nodeId?: string;
  autoFix?: boolean;
}

// ── Flow Types ─────────────────────────────────────────────────────

export interface GraphFlow {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  nodes: string[];
  entryNodeId: string;
  status: 'draft' | 'active' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export type FlowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export interface FlowExecution {
  id: string;
  flowId: string;
  projectId: string;
  status: FlowStatus;
  currentNodeId?: string | null;
  completedNodes: string[];
  context: Record<string, unknown>;
  startedAt: string;
  completedAt?: string | null;
  error?: string | null;
}
