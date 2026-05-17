export type AgentStatus = 'draft' | 'active' | 'archived';

export type ExecutionStatus =
  | 'pending'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'resuming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExecutionStepStatus = 'running' | 'completed' | 'failed';

export interface AgentDefinition {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  graphDefinition: AgentGraph;
  toolsConfig: ToolConfig[];
  modelConfig: ModelConfig;
  prompts: AgentPrompts;
  interruptConfig: InterruptConfig;
  version: number;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGraph {
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
}

export interface AgentGraphNode {
  id: string;
  type: 'llm_call' | 'tool_call' | 'conditional' | 'human_input' | 'sub_agent' | 'code_eval';
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface AgentGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: Record<string, unknown>;
}

export interface ToolConfig {
  name: string;
  description: string;
  source: 'built_in' | 'custom';
  config: Record<string, unknown>;
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
}

export interface AgentPrompts {
  system: string;
  fewShotExamples?: Array<{
    input: string;
    output: string;
  }>;
}

export interface InterruptConfig {
  enabled: boolean;
  points: string[];
  timeoutMs?: number;
}

export interface Execution {
  id: string;
  agentId: string;
  projectId: string;
  triggeredBy: string;
  status: ExecutionStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalDurationMs: number | null;
  totalLlmCalls: number;
  totalTokens: number;
  checkpointData: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ExecutionStep {
  id: string;
  executionId: string;
  stepType: string;
  nodeName: string;
  status: ExecutionStepStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  llmCallDurationMs: number | null;
  tokenCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}
