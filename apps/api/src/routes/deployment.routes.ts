import type { FastifyInstance } from 'fastify';

export async function deploymentRoutes(app: FastifyInstance): Promise<void> {
  // Generate deployment artifacts
  app.post('/:projectId/deploy/generate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      environment?: string;
      platform?: string;
      cloudProvider?: string;
      region?: string;
      domain?: string;
    };

    const result = await app.deploymentEngine.generateDeployment({
      projectId,
      environment: (body.environment as 'development' | 'staging' | 'production') ?? 'development',
      platform: (body.platform as 'docker' | 'kubernetes') ?? 'docker',
      cloudProvider: (body.cloudProvider as 'aws' | 'gcp' | 'azure'),
      region: body.region,
      domain: body.domain,
      scaling: { min: 1, max: 10, targetCpuPercent: 70 },
      monitoring: { prometheus: true, grafana: true, alerting: true },
      rollback: { enabled: true, maxRevisions: 5 },
    });

    return reply.send({
      success: result.success,
      data: {
        modules: result.modules.map((m) => ({ path: m.path, type: m.type, description: m.description })),
        plan: result.deploymentPlan,
        errors: result.errors,
      },
    });
  });

  // Simulate deployment (dry-run)
  app.post('/:projectId/deploy/simulate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await app.deploymentEngine.simulateDeployment({
      projectId,
      environment: 'development',
      platform: 'kubernetes',
      cloudProvider: 'aws',
      scaling: { min: 1, max: 10, targetCpuPercent: 70 },
      monitoring: { prometheus: true, grafana: true, alerting: true },
    });

    return reply.send({
      success: result.success,
      data: {
        mode: 'dry-run',
        modules: result.modules.map((m) => ({ path: m.path, type: m.type })),
        plan: result.deploymentPlan,
      },
    });
  });

  // Rollback deployment
  app.post('/:projectId/deploy/rollback', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { revision } = request.body as { revision?: string };

    await app.deploymentEngine.rollback(projectId, revision ?? 'previous');

    return reply.send({ success: true, data: { message: 'Rollback initiated', revision: revision ?? 'previous' } });
  });
}
