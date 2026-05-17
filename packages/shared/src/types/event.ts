export enum EventType {
  // Auth
  AuthUserRegistered = 'genesis-1.auth.user.registered',
  AuthUserLoggedIn = 'genesis-1.auth.user.logged-in',
  AuthUserLoggedOut = 'genesis-1.auth.user.logged-out',
  AuthTokenRefreshed = 'genesis-1.auth.token.refreshed',

  // Project
  ProjectCreated = 'genesis-1.project.created',
  ProjectUpdated = 'genesis-1.project.updated',
  ProjectDeleted = 'genesis-1.project.deleted',
  ProjectMemberAdded = 'genesis-1.project.member.added',
  ProjectMemberRemoved = 'genesis-1.project.member.removed',

  // Graph — Nodes
  NodeCreated = 'genesis-1.graph.node.created',
  NodeUpdated = 'genesis-1.graph.node.updated',
  NodeDeleted = 'genesis-1.graph.node.deleted',
  NodeMoved = 'genesis-1.graph.node.moved',

  // Graph — Edges
  EdgeCreated = 'genesis-1.graph.edge.created',
  EdgeUpdated = 'genesis-1.graph.edge.updated',
  EdgeRemoved = 'genesis-1.graph.edge.removed',

  // Graph — Structure
  GraphCycleDetected = 'genesis-1.graph.cycle.detected',
  GraphSnapshotCreated = 'genesis-1.graph.snapshot.created',
  GraphBranchCreated = 'genesis-1.graph.branch.created',
  GraphBranchMerged = 'genesis-1.graph.branch.merged',
  GraphTopologyValidated = 'genesis-1.graph.topology.validated',

  // Flows
  FlowStarted = 'genesis-1.flow.started',
  FlowCompleted = 'genesis-1.flow.completed',
  FlowFailed = 'genesis-1.flow.failed',
  FlowNodeEntered = 'genesis-1.flow.node.entered',
  FlowNodeExited = 'genesis-1.flow.node.exited',

  // Simulation
  SimulationStarted = 'genesis-1.simulation.started',
  SimulationStopped = 'genesis-1.simulation.stopped',
  SimulationRunStarted = 'genesis-1.simulation.run.started',
  SimulationRunProgress = 'genesis-1.simulation.run.progress',
  SimulationRunCompleted = 'genesis-1.simulation.run.completed',
  SimulationRunFailed = 'genesis-1.simulation.run.failed',
  SimulationMilestoneReached = 'genesis-1.simulation.milestone.reached',

  // Generation
  GenerationStarted = 'genesis-1.generation.started',
  GenerationCompleted = 'genesis-1.generation.completed',
  GenerationFailed = 'genesis-1.generation.failed',
  GenerationModuleGenerated = 'genesis-1.generation.module.generated',

  // Deployment
  DeploymentStarted = 'genesis-1.deployment.started',
  DeploymentCompleted = 'genesis-1.deployment.completed',
  DeploymentFailed = 'genesis-1.deployment.failed',
  DeploymentRollback = 'genesis-1.deployment.rollback',

  // Rules
  RuleDefinitionCreated = 'genesis-1.rule.definition.created',
  RuleDefinitionUpdated = 'genesis-1.rule.definition.updated',
  RuleDefinitionDeleted = 'genesis-1.rule.definition.deleted',
  RuleEvaluationCompleted = 'genesis-1.rule.evaluation.completed',
  RuleViolation = 'genesis-1.rule.violation',
  RuleViolationCreated = 'genesis-1.rule.violation.created',
  RuleViolationResolved = 'genesis-1.rule.violation.resolved',

  // Agents
  AgentStarted = 'genesis-1.agent.started',
  AgentCompleted = 'genesis-1.agent.completed',
  AgentFailed = 'genesis-1.agent.failed',
  AgentDefinitionCreated = 'genesis-1.agent.definition.created',
  AgentDefinitionUpdated = 'genesis-1.agent.definition.updated',
  AgentDefinitionDeleted = 'genesis-1.agent.definition.deleted',
  AgentExecutionStarted = 'genesis-1.agent.execution.started',
  AgentExecutionProgress = 'genesis-1.agent.execution.progress',
  AgentExecutionCompleted = 'genesis-1.agent.execution.completed',
  AgentExecutionFailed = 'genesis-1.agent.execution.failed',
  AgentExecutionPaused = 'genesis-1.agent.execution.paused',
  AgentExecutionResumed = 'genesis-1.agent.execution.resumed',
  AgentExecutionCancelled = 'genesis-1.agent.execution.cancelled',
  AgentToolInvoked = 'genesis-1.agent.tool.invoked',
  AgentToolResulted = 'genesis-1.agent.tool.resulted',

  // WebSocket
  WsClientConnected = 'genesis-1.ws.client.connected',
  WsClientDisconnected = 'genesis-1.ws.client.disconnected',
}

export interface EventEnvelope {
  id: string;
  type: EventType;
  source: string;
  correlationId: string;
  causationId?: string;
  timestamp: string;
  userId?: string;
  projectId?: string;
  payload: Record<string, unknown>;
  metadata: EventMetadata;
}

export interface EventMetadata {
  version: number;
  priority: 'low' | 'normal' | 'high';
  ttl?: number;
}
