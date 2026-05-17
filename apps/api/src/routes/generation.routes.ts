import type { FastifyInstance } from 'fastify';

export async function generationRoutes(app: FastifyInstance): Promise<void> {
  // Generate code from graph
  app.post('/:projectId/generate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as { targetStack?: string; outputDir?: string; options?: Record<string, unknown> };

    const result = await app.generationEngine.generate({
      projectId,
      targetStack: (body.targetStack as 'react' | 'nextjs' | 'nodejs') ?? 'nodejs',
      outputDir: body.outputDir ?? `generated/${projectId}`,
      options: body.options ?? {},
    });

    return reply.send({
      success: result.success,
      data: {
        modules: result.modules.map((m) => ({
          path: m.path,
          language: m.language,
          type: m.type,
          content: m.content.slice(0, 500) + (m.content.length > 500 ? '...' : ''),
        })),
        stats: result.stats,
        errors: result.errors,
      },
    });
  });

  // Execute the full execution loop
  app.post('/:projectId/execute-loop', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.headers['x-user-id'] as string) ?? 'anonymous';

    // Step 1: Validate topology
    const topology = await app.graphEngine.validateTopology(projectId);

    // Step 2: Plan tasks via orchestrator
    const plan = await app.orchestrator.planFromGraph(projectId, userId);

    // Step 3: Execute plan
    const results = await app.orchestrator.executePlan(projectId, userId);

    // Step 4: Generate code
    const generation = await app.generationEngine.generate({
      projectId,
      targetStack: 'nodejs',
      outputDir: `generated/${projectId}`,
      options: {},
    });

    // Step 5: Generate deployment artifacts
    const deployment = await app.deploymentEngine.generateDeployment({
      projectId,
      environment: 'development',
      platform: 'docker',
      scaling: { min: 1, max: 5, targetCpuPercent: 70 },
      monitoring: { prometheus: true, grafana: true, alerting: true },
    });

    // Step 6: Evolution insights
    const evolution = await app.evolutionEngine.evolve({
      projectId,
      enableSelfHealing: true,
      enableAutoUpgrade: false,
      enableInsights: true,
    });

    return reply.send({
      success: true,
      data: {
        topology: { valid: topology.valid, errors: topology.errors.length, warnings: topology.warnings.length },
        plan: { taskCount: plan.length },
        execution: results.map((r) => ({ type: r.type, status: r.status })),
        generation: { files: generation.stats.totalFiles, lines: generation.stats.totalLines },
        deployment: { modules: deployment.modules.length },
        evolution: { insights: evolution.insights.length, fixes: evolution.appliedFixes.length },
      },
    });
  });
}
