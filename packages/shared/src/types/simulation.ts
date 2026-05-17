export type SimulationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SimulationDefinition {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  initialState: Record<string, unknown>;
  eventGenerators: EventGeneratorConfig[];
  rulesConfig: SimulationRulesConfig;
  termination: TerminationConfig;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventGeneratorConfig {
  type: 'traffic' | 'failure' | 'scaling' | 'dependency' | 'custom';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface SimulationRulesConfig {
  ruleSetIds: string[];
  evaluateOnEveryEvent: boolean;
}

export interface TerminationConfig {
  maxSteps: number;
  maxTime: number;
  stabilityThreshold: number;
}

export interface SimulationRun {
  id: string;
  definitionId: string;
  projectId: string;
  triggeredBy: string;
  status: SimulationStatus;
  totalSteps: number;
  clockEnd: number;
  metrics: SimulationMetrics | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface SimulationMetrics {
  avgLatencyP50: number;
  avgLatencyP95: number;
  avgLatencyP99: number;
  throughput: number;
  errorRate: number;
  availability: number;
  cascadeDepth: number;
  recoveryTimeMs: number;
}

export interface SimulationEvent {
  id: string;
  runId: string;
  simTime: number;
  eventType: string;
  source: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}
