export const EVENT_CHANNELS = {
  // Auth
  AUTH_USER_REGISTERED: 'genesis-1.auth.user.registered',
  AUTH_USER_LOGGED_IN: 'genesis-1.auth.user.logged-in',
  AUTH_USER_LOGGED_OUT: 'genesis-1.auth.user.logged-out',
  AUTH_TOKEN_REFRESHED: 'genesis-1.auth.token.refreshed',

  // Project
  PROJECT_CREATED: 'genesis-1.project.created',
  PROJECT_UPDATED: 'genesis-1.project.updated',
  PROJECT_DELETED: 'genesis-1.project.deleted',
  PROJECT_MEMBER_ADDED: 'genesis-1.project.member.added',
  PROJECT_MEMBER_REMOVED: 'genesis-1.project.member.removed',

  // Graph — Nodes
  NODE_CREATED: 'genesis-1.graph.node.created',
  NODE_UPDATED: 'genesis-1.graph.node.updated',
  NODE_DELETED: 'genesis-1.graph.node.deleted',
  NODE_MOVED: 'genesis-1.graph.node.moved',

  // Graph — Edges
  EDGE_CREATED: 'genesis-1.graph.edge.created',
  EDGE_UPDATED: 'genesis-1.graph.edge.updated',
  EDGE_REMOVED: 'genesis-1.graph.edge.removed',

  // Graph — Structure
  GRAPH_CYCLE_DETECTED: 'genesis-1.graph.cycle.detected',
  GRAPH_SNAPSHOT_CREATED: 'genesis-1.graph.snapshot.created',
  GRAPH_BRANCH_CREATED: 'genesis-1.graph.branch.created',
  GRAPH_BRANCH_MERGED: 'genesis-1.graph.branch.merged',
  GRAPH_TOPOLOGY_VALIDATED: 'genesis-1.graph.topology.validated',

  // Flows
  FLOW_STARTED: 'genesis-1.flow.started',
  FLOW_COMPLETED: 'genesis-1.flow.completed',
  FLOW_FAILED: 'genesis-1.flow.failed',
  FLOW_NODE_ENTERED: 'genesis-1.flow.node.entered',
  FLOW_NODE_EXITED: 'genesis-1.flow.node.exited',

  // Simulation
  SIMULATION_STARTED: 'genesis-1.simulation.started',
  SIMULATION_STOPPED: 'genesis-1.simulation.stopped',
  SIMULATION_RUN_STARTED: 'genesis-1.simulation.run.started',
  SIMULATION_RUN_PROGRESS: 'genesis-1.simulation.run.progress',
  SIMULATION_RUN_COMPLETED: 'genesis-1.simulation.run.completed',
  SIMULATION_RUN_FAILED: 'genesis-1.simulation.run.failed',
  SIMULATION_MILESTONE_REACHED: 'genesis-1.simulation.milestone.reached',

  // Generation
  GENERATION_STARTED: 'genesis-1.generation.started',
  GENERATION_COMPLETED: 'genesis-1.generation.completed',
  GENERATION_FAILED: 'genesis-1.generation.failed',
  GENERATION_MODULE_GENERATED: 'genesis-1.generation.module.generated',

  // Deployment
  DEPLOYMENT_STARTED: 'genesis-1.deployment.started',
  DEPLOYMENT_COMPLETED: 'genesis-1.deployment.completed',
  DEPLOYMENT_FAILED: 'genesis-1.deployment.failed',
  DEPLOYMENT_ROLLBACK: 'genesis-1.deployment.rollback',

  // Rules
  RULE_DEFINITION_CREATED: 'genesis-1.rule.definition.created',
  RULE_DEFINITION_UPDATED: 'genesis-1.rule.definition.updated',
  RULE_DEFINITION_DELETED: 'genesis-1.rule.definition.deleted',
  RULE_EVALUATION_COMPLETED: 'genesis-1.rule.evaluation.completed',
  RULE_VIOLATION: 'genesis-1.rule.violation',
  RULE_VIOLATION_CREATED: 'genesis-1.rule.violation.created',
  RULE_VIOLATION_RESOLVED: 'genesis-1.rule.violation.resolved',

  // Agents
  AGENT_STARTED: 'genesis-1.agent.started',
  AGENT_COMPLETED: 'genesis-1.agent.completed',
  AGENT_FAILED: 'genesis-1.agent.failed',
  AGENT_DEFINITION_CREATED: 'genesis-1.agent.definition.created',
  AGENT_DEFINITION_UPDATED: 'genesis-1.agent.definition.updated',
  AGENT_DEFINITION_DELETED: 'genesis-1.agent.definition.deleted',

  // All agent sub-types
  AGENT_EXECUTION_STARTED: 'genesis-1.agent.execution.started',
  AGENT_EXECUTION_PROGRESS: 'genesis-1.agent.execution.progress',
  AGENT_EXECUTION_COMPLETED: 'genesis-1.agent.execution.completed',
  AGENT_EXECUTION_FAILED: 'genesis-1.agent.execution.failed',
  AGENT_EXECUTION_PAUSED: 'genesis-1.agent.execution.paused',
  AGENT_EXECUTION_RESUMED: 'genesis-1.agent.execution.resumed',
  AGENT_EXECUTION_CANCELLED: 'genesis-1.agent.execution.cancelled',
  AGENT_TOOL_INVOKED: 'genesis-1.agent.tool.invoked',
  AGENT_TOOL_RESULTED: 'genesis-1.agent.tool.resulted',

  // WebSocket
  WS_CLIENT_CONNECTED: 'genesis-1.ws.client.connected',
  WS_CLIENT_DISCONNECTED: 'genesis-1.ws.client.disconnected',
} as const;

export const WS_CLIENT_SCOPES = {
  userAll: (userId: string) => `user:${userId}:*`,
  userAgents: (userId: string) => `user:${userId}:agent:*`,
  projectAll: (projectId: string) => `project:${projectId}:*`,
  projectGraph: (projectId: string) => `project:${projectId}:graph:*`,
  projectAgent: (projectId: string) => `project:${projectId}:agent:*`,
  projectAgentExec: (execId: string) => `project:*:agent:${execId}`,
  projectSimulation: (projectId: string) => `project:${projectId}:simulation:*`,
  projectSimulationRun: (runId: string) => `project:*:simulation:${runId}`,
  projectFlow: (projectId: string) => `project:${projectId}:flow:*`,
  projectGeneration: (projectId: string) => `project:${projectId}:generation:*`,
} as const;
