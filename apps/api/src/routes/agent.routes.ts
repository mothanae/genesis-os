import type { FastifyInstance } from 'fastify';
import { createAgentSchema, executeAgentSchema } from '@genesis-1/shared/schemas';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // List agents
  app.get('/:projectId/agents', async (request, reply) => {
    return reply.send({ success: true, data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  // Create agent
  app.post('/:projectId/agents', async (request, reply) => {
    const body = createAgentSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    return reply.status(201).send({ success: true, data: body.data });
  });

  // Get agent
  app.get('/:projectId/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    return reply.send({ success: true, data: { id: agentId } });
  });

  // Update agent
  app.patch('/:projectId/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    return reply.send({ success: true, data: { id: agentId } });
  });

  // Delete agent
  app.delete('/:projectId/agents/:agentId', async (request, reply) => {
    return reply.send({ success: true, data: { message: 'Agent deleted' } });
  });

  // Execute agent (async)
  app.post('/:projectId/agents/:agentId/execute', async (request, reply) => {
    const { projectId, agentId } = request.params as { projectId: string; agentId: string };
    const body = executeAgentSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    const execution = await app.agentRuntime.startExecution(agentId, projectId, 'stub-user', body.data.input);
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
    if (!execution) return reply.status(404).send({ success: false, error: 'Execution not found' });
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
