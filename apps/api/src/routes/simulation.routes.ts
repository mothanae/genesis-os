import type { FastifyInstance } from 'fastify';
import { createSimulationSchema } from '@genesis-1/shared/schemas';

export async function simulationRoutes(app: FastifyInstance): Promise<void> {
  // List simulations
  app.get('/:projectId/simulations', async (request, reply) => {
    return reply.send({ success: true, data: [] });
  });

  // Create simulation
  app.post('/:projectId/simulations', async (request, reply) => {
    const body = createSimulationSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    return reply.status(201).send({ success: true, data: body.data });
  });

  // Get simulation
  app.get('/:projectId/simulations/:simId', async (request, reply) => {
    return reply.send({ success: true, data: {} });
  });

  // Update simulation
  app.patch('/:projectId/simulations/:simId', async (request, reply) => {
    return reply.send({ success: true, data: {} });
  });

  // Delete simulation
  app.delete('/:projectId/simulations/:simId', async (request, reply) => {
    return reply.send({ success: true, data: { message: 'Simulation deleted' } });
  });

  // Start simulation run
  app.post('/:projectId/simulations/:simId/run', async (request, reply) => {
    const { projectId, simId } = request.params as { projectId: string; simId: string };
    const run = await app.simulationEngine.startRun(simId, projectId, 'stub-user');
    return reply.status(202).send({ success: true, data: run });
  });

  // List runs
  app.get('/:projectId/simulations/:simId/runs', async (request, reply) => {
    const { simId } = request.params as { simId: string };
    const runs = await app.simulationEngine.listRuns(simId);
    return reply.send({ success: true, data: runs });
  });

  // Get run
  app.get('/:projectId/simulations/:simId/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await app.simulationEngine.getRun(runId);
    if (!run) return reply.status(404).send({ success: false, error: 'Run not found' });
    return reply.send({ success: true, data: run });
  });

  // Get run events
  app.get('/:projectId/simulations/:simId/runs/:runId/events', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const events = await app.simulationEngine.getRunEvents(runId);
    return reply.send({ success: true, data: events });
  });
}
