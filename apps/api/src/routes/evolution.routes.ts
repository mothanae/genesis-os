import type { FastifyInstance } from 'fastify';
import { evolveSchema } from '@genesis-1/shared/schemas';

export async function evolutionRoutes(app: FastifyInstance): Promise<void> {
  // Analyze and evolve the architecture
  app.post('/:projectId/evolve', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = evolveSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    const evolveResult = await app.evolutionEngine.evolve({
      projectId,
      enableSelfHealing: result.data.enableSelfHealing,
      enableAutoUpgrade: result.data.enableAutoUpgrade,
      enableInsights: result.data.enableInsights,
    });

    return reply.send({
      success: true,
      data: {
        insights: evolveResult.insights.map((i) => ({
          type: i.type,
          title: i.title,
          severity: i.severity,
          description: i.description,
          suggestion: i.suggestion,
          autoFixAvailable: i.autoFixAvailable,
          confidence: i.confidence,
        })),
        upgradePaths: evolveResult.upgradePaths.map((p) => ({
          name: p.name,
          description: p.description,
          steps: p.steps.length,
          estimatedEffortMinutes: p.estimatedEffortMinutes,
          risk: p.risk,
          automated: p.automated,
        })),
        appliedFixes: evolveResult.appliedFixes.map((f) => ({
          type: f.type,
          description: f.description,
          success: f.success,
        })),
        templateMatches: evolveResult.templateMatches.map((t) => ({
          templateName: t.templateName,
          matchScore: t.matchScore,
        })),
        snapshotId: evolveResult.snapshotId,
      },
    });
  });

  // Get architecture insights only
  app.get('/:projectId/insights', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { data: nodes } = await app.graphEngine.listNodes(projectId);
    const edges = await app.graphEngine.listEdges(projectId);

    const insights = await app.evolutionEngine.analyzeArchitecture(nodes, edges, projectId);

    return reply.send({
      success: true,
      data: insights.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        severity: i.severity,
        description: i.description,
        suggestion: i.suggestion,
        autoFixAvailable: i.autoFixAvailable,
      })),
    });
  });

  // List available architecture templates
  app.get('/:projectId/templates', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { data: nodes } = await app.graphEngine.listNodes(projectId);
    const edges = await app.graphEngine.listEdges(projectId);

    const matches = await (app.evolutionEngine as EvolutionEngineWithTemplates).matchTemplates?.(nodes, edges) ?? [];

    return reply.send({ success: true, data: matches });
  });
}

interface EvolutionEngineWithTemplates {
  matchTemplates?: (nodes: unknown[], edges: unknown[]) => Promise<unknown[]>;
}
