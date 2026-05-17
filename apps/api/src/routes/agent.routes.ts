import type { FastifyInstance } from 'fastify';
import { createAgentSchema, updateAgentSchema, executeAgentSchema } from '@genesis-1/shared/schemas';
import { agentDefinitions } from '@genesis-1/database';
import { eq, and, sql } from 'drizzle-orm';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // List agents
  app.get('/:projectId/agents', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await app.db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.projectId, projectId))
      .orderBy(sql`${agentDefinitions.updatedAt} DESC`);

    return reply.send({
      success: true,
      data: result,
      meta: { total: result.length },
    });
  });

  // Create agent
  app.post('/:projectId/agents', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = createAgentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const result = await app.db
      .insert(agentDefinitions)
      .values({
        projectId,
        name: body.data.name,
        description: body.data.description ?? null,
        graphDefinition: body.data.graphDefinition,
        toolsConfig: body.data.toolsConfig ?? [],
        modelConfig: body.data.modelConfig,
        prompts: body.data.prompts,
        interruptConfig: body.data.interruptConfig ?? { enabled: false, points: [] },
      })
      .returning();

    return reply.status(201).send({ success: true, data: result[0] });
  });

  // Get agent
  app.get('/:projectId/agents/:agentId', async (request, reply) => {
    const { projectId, agentId } = request.params as { projectId: string; agentId: string };

    const result = await app.db
      .select()
      .from(agentDefinitions)
      .where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.projectId, projectId)))
      .limit(1);

    if (result.length === 0) {
      return reply.status(404).send({ success: false, error: 'Agent not found' });
    }

    return reply.send({ success: true, data: result[0] });
  });

  // Update agent
  app.patch('/:projectId/agents/:agentId', async (request, reply) => {
    const { projectId, agentId } = request.params as { projectId: string; agentId: string };
    const body = updateAgentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const existing = await app.db
      .select({ id: agentDefinitions.id })
      .from(agentDefinitions)
      .where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Agent not found' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.data.name !== undefined) updates.name = body.data.name;
    if (body.data.description !== undefined) updates.description = body.data.description;
    if (body.data.graphDefinition !== undefined) updates.graphDefinition = body.data.graphDefinition;
    if (body.data.toolsConfig !== undefined) updates.toolsConfig = body.data.toolsConfig;
    if (body.data.modelConfig !== undefined) updates.modelConfig = body.data.modelConfig;
    if (body.data.prompts !== undefined) updates.prompts = body.data.prompts;
    if (body.data.interruptConfig !== undefined) updates.interruptConfig = body.data.interruptConfig;

    const result = await app.db
      .update(agentDefinitions)
      .set(updates)
      .where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.projectId, projectId)))
      .returning();

    return reply.send({ success: true, data: result[0] });
  });

  // Delete agent
  app.delete('/:projectId/agents/:agentId', async (request, reply) => {
    const { projectId, agentId } = request.params as { projectId: string; agentId: string };

    const existing = await app.db
      .select({ id: agentDefinitions.id })
      .from(agentDefinitions)
      .where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Agent not found' });
    }

    await app.db
      .delete(agentDefinitions)
      .where(and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.projectId, projectId)));

    return reply.send({ success: true, data: { message: 'Agent deleted' } });
  });

  // Execute agent (async)
  app.post('/:projectId/agents/:agentId/execute', async (request, reply) => {
    const { projectId, agentId } = request.params as { projectId: string; agentId: string };
    const body = executeAgentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const execution = await app.agentRuntime.startExecution(agentId, projectId, 'api-user', body.data.input);
    return reply.status(202).send({ success: true, data: execution });
  });

  // List executions
  app.get('/:projectId/agents/:agentId/executions', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const executions = await app.agentRuntime.listExecutions(agentId);
    return reply.send({ success: true, data: executions });
  });

  // Get execution
  app.get('/:projectId/agents/:agentId/executions/:execId', async (request, reply) => {
    const { execId } = request.params as { execId: string };
    const execution = await app.agentRuntime.getExecution(execId);
    if (!execution) {
      return reply.status(404).send({ success: false, error: 'Execution not found' });
    }
    return reply.send({ success: true, data: execution });
  });

  // Pause execution
  app.post('/:projectId/agents/:agentId/executions/:execId/pause', async (request, reply) => {
    const { execId } = request.params as { execId: string };
    await app.agentRuntime.pauseExecution(execId);
    return reply.send({ success: true, data: { message: 'Execution paused' } });
  });

  // Resume execution
  app.post('/:projectId/agents/:agentId/executions/:execId/resume', async (request, reply) => {
    const { execId } = request.params as { execId: string };
    await app.agentRuntime.resumeExecution(execId);
    return reply.send({ success: true, data: { message: 'Execution resumed' } });
  });

  // Cancel execution
  app.post('/:projectId/agents/:agentId/executions/:execId/cancel', async (request, reply) => {
    const { execId } = request.params as { execId: string };
    await app.agentRuntime.cancelExecution(execId);
    return reply.send({ success: true, data: { message: 'Execution cancelled' } });
  });

  // Get execution steps
  app.get('/:projectId/agents/:agentId/executions/:execId/steps', async (request, reply) => {
    const { execId } = request.params as { execId: string };
    const steps = await app.agentRuntime.getExecutionSteps(execId);
    return reply.send({ success: true, data: steps });
  });
}
