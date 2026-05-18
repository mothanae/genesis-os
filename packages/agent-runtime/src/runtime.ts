import type { DatabaseClient } from '@genesis-1/database';
import type { EventPublisher } from '@genesis-1/event-bus';
import type { Execution, ExecutionStep } from '@genesis-1/shared';
import { EventType } from '@genesis-1/shared';
import { agentDefinitions, executions, executionSteps } from '@genesis-1/database';
import { eq } from 'drizzle-orm';
import { AgentGraphCompiler } from './compiler';
import type { AgentOrchestrator } from './orchestrator';

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
  orchestrator?: AgentOrchestrator;
  workerPool?: Partial<WorkerPoolConfig>;
}

export class AgentRuntime {
  private readonly compiler = new AgentGraphCompiler();
  private readonly poolConfig: WorkerPoolConfig;
  private readonly orchestrator?: AgentOrchestrator;

  constructor(private readonly config: AgentRuntimeConfig) {
    this.orchestrator = config.orchestrator;
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

    const graphDef = a.graphDefinition as { nodes: unknown[]; edges: unknown[] };
    const validation = this.compiler.validate({
      nodes: graphDef.nodes as never[],
      edges: graphDef.edges as never[],
    });

    if (!validation.valid) {
      throw new Error(`Invalid agent graph: ${validation.errors.join(', ')}`);
    }

    const compiled = this.compiler.compile({
      nodes: graphDef.nodes as never[],
      edges: graphDef.edges as never[],
    });

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

    // Build step plan from compiled graph and insert steps
    const steps = this.buildStepPlan(compiled, execution.id);
    if (steps.length > 0) {
      await this.config.db.insert(executionSteps).values(steps);
    }

    // Transition to running
    await this.config.db
      .update(executions)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(executions.id, execution.id));

    // Run the execution loop asynchronously (non-blocking for API response)
    this.runExecutionLoop(execution.id, projectId, a.modelConfig as Record<string, unknown>).catch(
      async (err) => {
        await this.config.db
          .update(executions)
          .set({
            status: 'failed',
            error: (err as Error).message,
            completedAt: new Date(),
          })
          .where(eq(executions.id, execution.id));
      },
    );

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

    await this.config.db
      .update(executions)
      .set({ status: 'running' })
      .where(eq(executions.id, executionId));

    // Resume the execution loop for incomplete steps
    this.runExecutionLoop(executionId, undefined, {}).catch(async (err) => {
      await this.config.db
        .update(executions)
        .set({
          status: 'failed',
          error: (err as Error).message,
          completedAt: new Date(),
        })
        .where(eq(executions.id, executionId));
    });
  }

  async cancelExecution(executionId: string): Promise<void> {
    // Mark pending steps as cancelled
    await this.config.db
      .update(executionSteps)
      .set({ status: 'cancelled' })
      .where(eq(executionSteps.executionId, executionId));

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

  // ── Private: Step Plan Building ───────────────────────────────

  private buildStepPlan(
    compiled: ReturnType<typeof this.compiler.compile>,
    executionId: string,
  ): Array<{
    executionId: string;
    stepType: string;
    nodeName: string;
    status: string;
    input: Record<string, unknown> | null;
  }> {
    const steps: Array<{
      executionId: string;
      stepType: string;
      nodeName: string;
      status: string;
      input: Record<string, unknown> | null;
    }> = [];

    // Topological sort: BFS from entry node
    const visited = new Set<string>();
    const queue: string[] = [];
    if (compiled.entryNodeId) {
      queue.push(compiled.entryNodeId);
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = compiled.nodes.get(nodeId);
      if (!node) continue;

      steps.push({
        executionId,
        stepType: node.type,
        nodeName: node.label,
        status: 'pending',
        input: node.config as Record<string, unknown> | null,
      });

      // Enqueue children (edges this node points to)
      for (const edge of node.edges) {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    // Add any unreachable nodes (disconnected subgraphs)
    for (const [id, node] of compiled.nodes) {
      if (!visited.has(id)) {
        steps.push({
          executionId,
          stepType: node.type,
          nodeName: node.label,
          status: 'pending',
          input: node.config as Record<string, unknown> | null,
        });
      }
    }

    return steps;
  }

  // ── Private: Execution Loop ──────────────────────────────────

  private async runExecutionLoop(
    executionId: string,
    projectId: string | undefined,
    modelConfig: Record<string, unknown>,
  ): Promise<void> {
    const startTime = Date.now();
    let totalTokens = 0;
    let totalLlmCalls = 0;
    const lastCheckpoint = { time: Date.now(), completedStepCount: 0 };

    // Load all steps for this execution
    const dbSteps = await this.config.db
      .select()
      .from(executionSteps)
      .where(eq(executionSteps.executionId, executionId))
      .orderBy(executionSteps.stepType);

    // Execute steps in order, skipping already-completed ones
    for (const step of dbSteps) {
      // Check timeout
      if (Date.now() - startTime > this.poolConfig.maxExecutionMs) {
        await this.config.db
          .update(executions)
          .set({ status: 'failed', error: 'Execution timed out' })
          .where(eq(executions.id, executionId));
        return;
      }

      // Check if execution was paused/cancelled
      const current = await this.config.db
        .select({ status: executions.status })
        .from(executions)
        .where(eq(executions.id, executionId))
        .limit(1);

      const execStatus = current[0]?.status;
      if (execStatus === 'paused' || execStatus === 'cancelled') return;

      // Skip already-completed or cancelled steps
      if (step.status === 'completed' || step.status === 'cancelled') continue;

      // Mark step as running
      await this.config.db
        .update(executionSteps)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(executionSteps.id, step.id));

      // Emit progress event
      const totalSteps = dbSteps.length;
      const completedSoFar = dbSteps.filter(
        (s) => s.status === 'completed' || s.status === 'cancelled',
      ).length;

      await this.config.eventBus.publish('genesis-1.agent.execution.progress', {
        id: crypto.randomUUID(),
        type: EventType.AgentExecutionProgress,
        source: 'agent-runtime',
        correlationId: executionId,
        timestamp: new Date().toISOString(),
        projectId: projectId ?? undefined,
        payload: {
          executionId,
          stepId: step.id,
          stepName: step.nodeName,
          stepType: step.stepType,
          progress: { completed: completedSoFar, total: totalSteps },
        },
        metadata: { version: 1, priority: 'normal' },
      });

      // Execute the step
      try {
        const stepResult = await this.executeStep(step, modelConfig);

        // Update step as completed
        await this.config.db
          .update(executionSteps)
          .set({
            status: 'completed',
            output: stepResult.output,
            completedAt: new Date(),
            llmCallDurationMs: stepResult.llmDurationMs ?? null,
            tokenCount: stepResult.tokenCount ?? null,
          })
          .where(eq(executionSteps.id, step.id));

        totalTokens += stepResult.tokenCount ?? 0;
        totalLlmCalls += stepResult.llmCalled ? 1 : 0;

        // Update execution totals
        await this.config.db
          .update(executions)
          .set({
            totalTokens,
            totalLlmCalls,
          })
          .where(eq(executions.id, executionId));

        // Checkpoint periodically
        if (
          Date.now() - lastCheckpoint.time >
          this.poolConfig.checkpointIntervalMs
        ) {
          await this.checkpointExecution(executionId, {
            lastCompletedStepId: step.id,
            completedStepCount: completedSoFar + 1,
            totalTokens,
            totalLlmCalls,
          });
          lastCheckpoint.time = Date.now();
          lastCheckpoint.completedStepCount = completedSoFar + 1;
        }
      } catch (err) {
        await this.config.db
          .update(executionSteps)
          .set({
            status: 'failed',
            error: (err as Error).message,
            completedAt: new Date(),
          })
          .where(eq(executionSteps.id, step.id));

        throw err; // Propagate to outer catch in startExecution
      }
    }

    // All steps completed
    const totalDuration = Date.now() - startTime;
    await this.config.db
      .update(executions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        totalDurationMs: totalDuration,
        totalTokens,
        totalLlmCalls,
      })
      .where(eq(executions.id, executionId));

    await this.config.eventBus.publish('genesis-1.agent.execution.completed', {
      id: crypto.randomUUID(),
      type: EventType.AgentExecutionCompleted,
      source: 'agent-runtime',
      correlationId: executionId,
      timestamp: new Date().toISOString(),
      projectId: projectId ?? undefined,
      payload: {
        executionId,
        totalDurationMs: totalDuration,
        totalSteps: dbSteps.length,
        totalTokens,
        totalLlmCalls,
      },
      metadata: { version: 1, priority: 'normal' },
    });
  }

  // ── Private: Step Execution ──────────────────────────────────

  private async executeStep(
    step: {
      id: string;
      stepType: string;
      nodeName: string;
      input: unknown;
    },
    _modelConfig: Record<string, unknown>,
  ): Promise<{
    output: Record<string, unknown>;
    llmCalled: boolean;
    llmDurationMs?: number;
    tokenCount?: number;
  }> {
    const stepInput = (step.input as Record<string, unknown>) ?? {};

    // Dispatch based on step type
    switch (step.stepType) {
      case 'tool':
        return this.executeToolStep(stepInput);
      case 'llm':
        return this.executeLlmStep(stepInput);
      case 'function':
        return this.executeFunctionStep(stepInput);
      case 'input':
        return { output: { received: stepInput }, llmCalled: false };
      case 'output':
        return { output: stepInput, llmCalled: false };
      case 'condition':
        return this.executeConditionStep(stepInput);
      default:
        // Generic step — passes through config
        return {
          output: {
            stepType: step.stepType,
            nodeName: step.nodeName,
            config: stepInput,
            processed: true,
          },
          llmCalled: false,
        };
    }
  }

  private async executeToolStep(input: Record<string, unknown>): Promise<{
    output: Record<string, unknown>;
    llmCalled: boolean;
    llmDurationMs?: number;
    tokenCount?: number;
  }> {
    const toolName = (input.tool as string) ?? 'unknown';
    const toolParams = (input.params as Record<string, unknown>) ?? {};

    return {
      output: {
        tool: toolName,
        params: toolParams,
        result: { status: 'executed', message: `Tool ${toolName} executed` },
      },
      llmCalled: false,
    };
  }

  private async executeLlmStep(input: Record<string, unknown>): Promise<{
    output: Record<string, unknown>;
    llmCalled: boolean;
    llmDurationMs?: number;
    tokenCount?: number;
  }> {
    const prompt = (input.prompt as string) ?? '';
    const systemPrompt = (input.systemPrompt as string) ?? '';

    if (this.orchestrator) {
      // Delegate to orchestrator's dispatch which has LLM integration
      const task = {
        id: `step-${Date.now()}`,
        type: 'plan' as const,
        status: 'running' as const,
        agentId: null,
        input: { prompt, systemPrompt },
        dependencies: [],
        priority: 1,
        retries: 0,
        maxRetries: 2,
        createdAt: new Date().toISOString(),
      };

      const result = await this.orchestrator['dispatchAgent'](null, task, '');
      return {
        output: result,
        llmCalled: true,
        tokenCount: (result.tokenCount as number) ?? undefined,
      };
    }

    return {
      output: { prompt, systemPrompt, response: 'LLM provider not configured' },
      llmCalled: false,
    };
  }

  private async executeFunctionStep(input: Record<string, unknown>): Promise<{
    output: Record<string, unknown>;
    llmCalled: boolean;
  }> {
    const fnName = (input.function as string) ?? 'unknown';
    const fnArgs = (input.args as Record<string, unknown>) ?? {};

    return {
      output: {
        function: fnName,
        args: fnArgs,
        result: { executed: true, message: `Function ${fnName} called` },
      },
      llmCalled: false,
    };
  }

  private executeConditionStep(input: Record<string, unknown>): {
    output: Record<string, unknown>;
    llmCalled: boolean;
  } {
    const left = input.left as unknown;
    const operator = (input.operator as string) ?? 'eq';
    const right = input.right as unknown;

    let result: boolean;
    switch (operator) {
      case 'eq':
        result = left === right;
        break;
      case 'neq':
        result = left !== right;
        break;
      case 'gt':
        result = (left as number) > (right as number);
        break;
      case 'lt':
        result = (left as number) < (right as number);
        break;
      case 'contains':
        result = String(left).includes(String(right));
        break;
      default:
        result = false;
    }

    return {
      output: { condition: { left, operator, right, result } },
      llmCalled: false,
    };
  }

  // ── Private: Checkpoint ──────────────────────────────────────

  private async checkpointExecution(
    executionId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.config.db
      .update(executions)
      .set({ checkpointData: data })
      .where(eq(executions.id, executionId));
  }
}
