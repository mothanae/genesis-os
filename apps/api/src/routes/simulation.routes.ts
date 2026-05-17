import type { FastifyInstance } from 'fastify';
import { createSimulationSchema, updateSimulationSchema } from '@genesis-1/shared/schemas';
import { simulationDefinitions } from '@genesis-1/database';
import { eq, and, sql } from 'drizzle-orm';

export async function simulationRoutes(app: FastifyInstance): Promise<void> {
  // List simulations
  app.get('/:projectId/simulations', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await app.db
      .select()
      .from(simulationDefinitions)
      .where(eq(simulationDefinitions.projectId, projectId))
      .orderBy(sql`${simulationDefinitions.updatedAt} DESC`);

    return reply.send({
      success: true,
      data: result,
      meta: { total: result.length },
    });
  });

  // Create simulation
  app.post('/:projectId/simulations', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = createSimulationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const result = await app.db
      .insert(simulationDefinitions)
      .values({
        projectId,
        name: body.data.name,
        description: body.data.description ?? null,
        initialState: body.data.initialState,
        eventGenerators: body.data.eventGenerators ?? [],
        rulesConfig: body.data.rulesConfig ?? {},
        termination: body.data.termination,
      })
      .returning();

    return reply.status(201).send({ success: true, data: result[0] });
  });

  // Get simulation
  app.get('/:projectId/simulations/:simId', async (request, reply) => {
    const { projectId, simId } = request.params as { projectId: string; simId: string };

    const result = await app.db
      .select()
      .from(simulationDefinitions)
      .where(
        and(
          eq(simulationDefinitions.id, simId),
          eq(simulationDefinitions.projectId, projectId),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return reply.status(404).send({ success: false, error: 'Simulation not found' });
    }

    return reply.send({ success: true, data: result[0] });
  });

  // Update simulation
  app.patch('/:projectId/simulations/:simId', async (request, reply) => {
    const { projectId, simId } = request.params as { projectId: string; simId: string };
    const body = updateSimulationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const existing = await app.db
      .select({ id: simulationDefinitions.id })
      .from(simulationDefinitions)
      .where(
        and(
          eq(simulationDefinitions.id, simId),
          eq(simulationDefinitions.projectId, projectId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Simulation not found' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.data.name !== undefined) updates.name = body.data.name;
    if (body.data.description !== undefined) updates.description = body.data.description;
    if (body.data.initialState !== undefined) updates.initialState = body.data.initialState;
    if (body.data.eventGenerators !== undefined) updates.eventGenerators = body.data.eventGenerators;
    if (body.data.rulesConfig !== undefined) updates.rulesConfig = body.data.rulesConfig;
    if (body.data.termination !== undefined) updates.termination = body.data.termination;

    const result = await app.db
      .update(simulationDefinitions)
      .set(updates)
      .where(
        and(
          eq(simulationDefinitions.id, simId),
          eq(simulationDefinitions.projectId, projectId),
        ),
      )
      .returning();

    return reply.send({ success: true, data: result[0] });
  });

  // Delete simulation
  app.delete('/:projectId/simulations/:simId', async (request, reply) => {
    const { projectId, simId } = request.params as { projectId: string; simId: string };

    const existing = await app.db
      .select({ id: simulationDefinitions.id })
      .from(simulationDefinitions)
      .where(
        and(
          eq(simulationDefinitions.id, simId),
          eq(simulationDefinitions.projectId, projectId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Simulation not found' });
    }

    await app.db
      .delete(simulationDefinitions)
      .where(
        and(
          eq(simulationDefinitions.id, simId),
          eq(simulationDefinitions.projectId, projectId),
        ),
      );

    return reply.send({ success: true, data: { message: 'Simulation deleted' } });
  });

  // Start simulation run
  app.post('/:projectId/simulations/:simId/run', async (request, reply) => {
    const { projectId, simId } = request.params as { projectId: string; simId: string };
    const run = await app.simulationEngine.startRun(simId, projectId, 'api-user');
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
    if (!run) {
      return reply.status(404).send({ success: false, error: 'Run not found' });
    }
    return reply.send({ success: true, data: run });
  });

  // Get run events
  app.get('/:projectId/simulations/:simId/runs/:runId/events', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const events = await app.simulationEngine.getRunEvents(runId);
    return reply.send({ success: true, data: events });
  });
}
