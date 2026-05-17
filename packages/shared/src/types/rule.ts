export type RuleDomain = 'graph' | 'agent' | 'simulation' | 'project';

export type EvaluationMode = 'sync' | 'async' | 'reactive';

export type EvaluationStrategy = 'first-match' | 'all-match' | 'priority';

export type RuleSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface RuleDefinition {
  id: string;
  projectId: string;
  ruleSetId: string | null;
  name: string;
  description: string | null;
  domain: RuleDomain;
  condition: Record<string, unknown>;
  action: RuleAction;
  enabled: boolean;
  priority: number;
  evaluationMode: EvaluationMode;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleAction {
  type: 'violation' | 'block' | 'notify' | 'webhook' | 'transform';
  severity?: RuleSeverity;
  message?: string;
  params?: Record<string, unknown>;
}

export interface RuleSet {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  evaluationStrategy: EvaluationStrategy;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationResult {
  id: string;
  ruleId: string;
  executionId: string | null;
  targetType: string;
  targetId: string;
  matched: boolean;
  context: Record<string, unknown>;
  evaluatedAt: string;
}

export interface RuleViolation {
  id: string;
  evaluationId: string;
  ruleId: string;
  projectId: string;
  severity: RuleSeverity;
  message: string;
  details: Record<string, unknown> | null;
  resolvedAt: string | null;
  createdAt: string;
}
