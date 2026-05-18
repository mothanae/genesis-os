import type { FastifyInstance } from 'fastify';
import { generateCodeSchema, executeLoopSchema } from '@genesis-1/shared/schemas';

export async function generationRoutes(app: FastifyInstance): Promise<void> {
  // Generate code from graph
  app.post('/:projectId/generate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = generateCodeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    const { targetStack, outputDir: bodyOutputDir, persist, options } = result.data;
    const outputDir = bodyOutputDir ?? `generated/${projectId}`;

    const genResult = persist
      ? await app.generationEngine.generateAndPersist({
          projectId,
          targetStack,
          outputDir,
          options,
        })
      : await app.generationEngine.generate({
          projectId,
          targetStack,
          outputDir,
          options,
        });

    const response: Record<string, unknown> = {
      modules: genResult.modules.map((m) => ({
        path: m.path,
        language: m.language,
        type: m.type,
        content: m.content,
      })),
      stats: genResult.stats,
      errors: genResult.errors,
    };

    if ('persisted' in genResult) {
      response.persisted = genResult.persisted;
    }

    return reply.send({ success: genResult.success, data: response });
  });

  // Execute the full execution loop
  app.post('/:projectId/execute-loop', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const bodyResult = executeLoopSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: bodyResult.error.flatten(),
      });
    }

    const { targetStack, options } = bodyResult.data;
    const userId = (request.headers['x-user-id'] as string) ?? 'anonymous';

    // Step 1: Validate topology
    const topology = await app.graphEngine.validateTopology(projectId);

    // Step 2: Plan tasks via orchestrator
    const plan = await app.orchestrator.planFromGraph(projectId, userId);

    // Step 3: Execute plan
    const results = await app.orchestrator.executePlan(projectId, userId);

    // Step 4: Generate code and persist to disk
    const generation = await app.generationEngine.generateAndPersist({
      projectId,
      targetStack,
      outputDir: `generated/${projectId}`,
      options,
    });

    // Step 5: Generate deployment artifacts
    const deployment = await app.deploymentEngine.generateDeployment({
      projectId,
      environment: 'development',
      platform: 'docker',
      scaling: { min: 1, max: 5, targetCpuPercent: 70 },
      monitoring: { prometheus: true, grafana: true, alerting: true },
    });

    // Step 6: Evolution insights (best-effort — requires snapshots table)
    let evolution = { insights: [] as unknown[], appliedFixes: [] as unknown[] };
    try {
      evolution = await app.evolutionEngine.evolve({
        projectId,
        enableSelfHealing: true,
        enableAutoUpgrade: false,
        enableInsights: true,
      });
    } catch (err) {
      app.log.warn({ err }, 'Evolution step failed (may need migrations)');
    }

    return reply.send({
      success: true,
      data: {
        topology: { valid: topology.valid, errors: topology.errors.length, warnings: topology.warnings.length },
        plan: { taskCount: plan.length },
        execution: results.map((r) => ({ type: r.type, status: r.status })),
        generation: {
          files: generation.stats.totalFiles,
          lines: generation.stats.totalLines,
          persisted: generation.persisted,
        },
        deployment: { modules: deployment.modules.length },
        evolution: { insights: evolution.insights.length, fixes: evolution.appliedFixes.length },
      },
    });
  });
}
