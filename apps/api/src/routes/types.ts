import type { DatabaseClient } from '@genesis-1/database';
import type { Redis } from 'ioredis';
import type { EventPublisher, EventSubscriber } from '@genesis-1/event-bus';
import type { GraphEngine } from '@genesis-1/graph-engine';
import type { RuleEngine } from '@genesis-1/rule-engine';
import type { AgentRuntime, AgentOrchestrator } from '@genesis-1/agent-runtime';
import type { SimulationEngine } from '@genesis-1/simulation-engine';
import type { GenerationEngine } from '@genesis-1/generation-engine';
import type { DeploymentEngine } from '@genesis-1/deployment-engine';
import type { EvolutionEngine } from '@genesis-1/evolution-engine';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseClient;
    redis: Redis;
    eventPublisher: EventPublisher;
    eventSubscriber: EventSubscriber;
    graphEngine: GraphEngine;
    ruleEngine: RuleEngine;
    agentRuntime: AgentRuntime;
    orchestrator: AgentOrchestrator;
    simulationEngine: SimulationEngine;
    generationEngine: GenerationEngine;
    deploymentEngine: DeploymentEngine;
    evolutionEngine: EvolutionEngine;
  }
}
