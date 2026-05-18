import type { FastifyInstance } from 'fastify';
import { deployGenerateSchema, deploySimulateSchema, rollbackSchema } from '@genesis-1/shared/schemas';

export async function deploymentRoutes(app: FastifyInstance): Promise<void> {
  // Generate deployment artifacts
  app.post('/:projectId/deploy/generate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = deployGenerateSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    const { environment, platform, cloudProvider, region, domain } = result.data;

    const deployResult = await app.deploymentEngine.generateDeployment({
      projectId,
      environment,
      platform,
      cloudProvider,
      region,
      domain,
      scaling: { min: 1, max: 10, targetCpuPercent: 70 },
      monitoring: { prometheus: true, grafana: true, alerting: true },
      rollback: { enabled: true, maxRevisions: 5 },
    });

    return reply.send({
      success: deployResult.success,
      data: {
        modules: deployResult.modules.map((m) => ({ path: m.path, type: m.type, description: m.description })),
        plan: deployResult.deploymentPlan,
        errors: deployResult.errors,
      },
    });
  });

  // Simulate deployment (dry-run)
  app.post('/:projectId/deploy/simulate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = deploySimulateSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    const { environment, platform, cloudProvider } = result.data;

    const simResult = await app.deploymentEngine.simulateDeployment({
      projectId,
      environment,
      platform,
      cloudProvider,
      scaling: { min: 1, max: 10, targetCpuPercent: 70 },
      monitoring: { prometheus: true, grafana: true, alerting: true },
    });

    return reply.send({
      success: simResult.success,
      data: {
        mode: 'dry-run',
        modules: simResult.modules.map((m) => ({ path: m.path, type: m.type })),
        plan: simResult.deploymentPlan,
      },
    });
  });

  // Rollback deployment
  app.post('/:projectId/deploy/rollback', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = rollbackSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    const { revision } = result.data;
    await app.deploymentEngine.rollback(projectId, revision ?? 'previous');

    return reply.send({ success: true, data: { message: 'Rollback initiated', revision: revision ?? 'previous' } });
  });
}
