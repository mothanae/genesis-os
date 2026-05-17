import type { DatabaseClient } from '@genesis-1/database';
import type { EventPublisher } from '@genesis-1/event-bus';
import type { Execution, ExecutionStep } from '@genesis-1/shared';
import { EventType } from '@genesis-1/shared';
import { agentDefinitions, executions, executionSteps } from '@genesis-1/database';
import { eq } from 'drizzle-orm';
import { AgentGraphCompiler } from './compiler';

export interface WorkerPoolConfig {
  minThreads: number;
  maxThreads: number;
  idleTimeoutMs: number;
  maxExecutionMs: number;
  checkpointIntervalMs: number;
}

export interface AgentRuntimeConfig {
  db: DatabaseClient;
  eventBus: EventPublisher;
  workerPool?: Partial<WorkerPoolConfig>;
}

export class AgentRuntime {
  private readonly compiler = new AgentGraphCompiler();
  private readonly poolConfig: WorkerPoolConfig;

  constructor(private readonly config: AgentRuntimeConfig) {
    this.poolConfig = {
      minThreads: 2,
      maxThreads: navigator?.hardwareConcurrency ?? 4,
      idleTimeoutMs: 300_000,
      maxExecutionMs: 600_000,
      checkpointIntervalMs: 10_000,
      ...config.workerPool,
    };
  }

  async startExecution(
    agentId: string,
    projectId: string,
    triggeredBy: string,
    input: Record<string, unknown> = {},
  ): Promise<Execution> {
    const agent = await this.config.db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.id, agentId))
      .limit(1);
    const a = agent[0];

    if (!a) throw new Error('Agent not found');

    // Validate graph
    const graphDef = a.graphDefinition as { nodes: unknown[]; edges: unknown[] };
    const validation = this.compiler.validate({
      nodes: graphDef.nodes as never[],
      edges: graphDef.edges as never[],
    });

    if (!validation.valid) {
      throw new Error(`Invalid agent graph: ${validation.errors.join(', ')}`);
    }

    // Create execution record
    const result = await this.config.db
      .insert(executions)
      .values({
        agentId,
        projectId,
        triggeredBy,
        status: 'initializing',
        input,
      })
      .returning();
    const execution = result[0]!;

    await this.config.eventBus.publish('genesis-1.agent.execution.started', {
      id: crypto.randomUUID(),
      type: EventType.AgentExecutionStarted,
      source: 'agent-runtime',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      projectId,
      payload: { executionId: execution.id, agentId, triggeredBy },
      metadata: { version: 1, priority: 'normal' },
    });

    // Transition to running
    await this.config.db
      .update(executions)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(executions.id, execution.id));

    return execution as unknown as Execution;
  }

  async pauseExecution(executionId: string): Promise<void> {
    await this.config.db
      .update(executions)
      .set({ status: 'paused' })
      .where(eq(executions.id, executionId));

    await this.config.eventBus.publish('genesis-1.agent.execution.paused', {
      id: crypto.randomUUID(),
      type: EventType.AgentExecutionPaused,
      source: 'agent-runtime',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { executionId },
      metadata: { version: 1, priority: 'normal' },
    });
  }

  async resumeExecution(executionId: string): Promise<void> {
    await this.config.db
      .update(executions)
      .set({ status: 'resuming' })
      .where(eq(executions.id, executionId));

    await this.config.eventBus.publish('genesis-1.agent.execution.resumed', {
      id: crypto.randomUUID(),
      type: EventType.AgentExecutionResumed,
      source: 'agent-runtime',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { executionId },
      metadata: { version: 1, priority: 'normal' },
    });

    // Transition back to running
    await this.config.db
      .update(executions)
      .set({ status: 'running' })
      .where(eq(executions.id, executionId));
  }

  async cancelExecution(executionId: string): Promise<void> {
    await this.config.db
      .update(executions)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(executions.id, executionId));

    await this.config.eventBus.publish('genesis-1.agent.execution.cancelled', {
      id: crypto.randomUUID(),
      type: EventType.AgentExecutionCancelled,
      source: 'agent-runtime',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { executionId },
      metadata: { version: 1, priority: 'normal' },
    });
  }

  async getExecution(executionId: string): Promise<Execution | null> {
    const result = await this.config.db
      .select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .limit(1);
    return (result[0] as unknown as Execution) ?? null;
  }

  async listExecutions(agentId: string, limit = 50): Promise<Execution[]> {
    const result = await this.config.db
      .select()
      .from(executions)
      .where(eq(executions.agentId, agentId))
      .limit(limit);
    return result as unknown as Execution[];
  }

  async getExecutionSteps(executionId: string): Promise<ExecutionStep[]> {
    const result = await this.config.db
      .select()
      .from(executionSteps)
      .where(eq(executionSteps.executionId, executionId));
    return result as unknown as ExecutionStep[];
  }
}
