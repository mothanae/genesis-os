import type { FastifyInstance } from 'fastify';

export async function evolutionRoutes(app: FastifyInstance): Promise<void> {
  // Analyze and evolve the architecture
  app.post('/:projectId/evolve', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      enableSelfHealing?: boolean;
      enableAutoUpgrade?: boolean;
      enableInsights?: boolean;
    };

    const result = await app.evolutionEngine.evolve({
      projectId,
      enableSelfHealing: body.enableSelfHealing ?? true,
      enableAutoUpgrade: body.enableAutoUpgrade ?? false,
      enableInsights: body.enableInsights ?? true,
    });

    return reply.send({
      success: true,
      data: {
        insights: result.insights.map((i) => ({
          type: i.type,
          title: i.title,
          severity: i.severity,
          description: i.description,
          suggestion: i.suggestion,
          autoFixAvailable: i.autoFixAvailable,
          confidence: i.confidence,
        })),
        upgradePaths: result.upgradePaths.map((p) => ({
          name: p.name,
          description: p.description,
          steps: p.steps.length,
          estimatedEffortMinutes: p.estimatedEffortMinutes,
          risk: p.risk,
          automated: p.automated,
        })),
        appliedFixes: result.appliedFixes.map((f) => ({
          type: f.type,
          description: f.description,
          success: f.success,
        })),
        templateMatches: result.templateMatches.map((t) => ({
          templateName: t.templateName,
          matchScore: t.matchScore,
        })),
        snapshotId: result.snapshotId,
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
