import type { FastifyInstance } from 'fastify';
import { createRuleSchema, createRuleSetSchema, evaluateRuleSchema } from '@genesis-1/shared/schemas';

export async function ruleRoutes(app: FastifyInstance): Promise<void> {
  // ── Rule Sets ─────────────────────────────────────────────────

  app.get('/:projectId/rules/sets', async (request, reply) => {
    return reply.send({ success: true, data: [] });
  });

  app.post('/:projectId/rules/sets', async (request, reply) => {
    const body = createRuleSetSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    return reply.status(201).send({ success: true, data: body.data });
  });

  app.get('/:projectId/rules/sets/:setId', async (request, reply) => {
    return reply.send({ success: true, data: {} });
  });

  app.patch('/:projectId/rules/sets/:setId', async (request, reply) => {
    return reply.send({ success: true, data: {} });
  });

  app.delete('/:projectId/rules/sets/:setId', async (request, reply) => {
    return reply.send({ success: true, data: { message: 'Rule set deleted' } });
  });

  // ── Rules ─────────────────────────────────────────────────────

  app.get('/:projectId/rules', async (request, reply) => {
    return reply.send({ success: true, data: [] });
  });

  app.post('/:projectId/rules', async (request, reply) => {
    const body = createRuleSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    return reply.status(201).send({ success: true, data: body.data });
  });

  app.get('/:projectId/rules/:ruleId', async (request, reply) => {
    return reply.send({ success: true, data: {} });
  });

  app.patch('/:projectId/rules/:ruleId', async (request, reply) => {
    return reply.send({ success: true, data: {} });
  });

  app.delete('/:projectId/rules/:ruleId', async (request, reply) => {
    return reply.send({ success: true, data: { message: 'Rule deleted' } });
  });

  // ── Evaluation ────────────────────────────────────────────────

  app.post('/:projectId/rules/:ruleId/evaluate', async (request, reply) => {
    const { ruleId } = request.params as { ruleId: string };
    const body = evaluateRuleSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    const result = await app.ruleEngine.evaluateRule(ruleId, body.data.facts);
    return reply.send({ success: true, data: result });
  });

  app.post('/:projectId/rules/evaluate-batch', async (request, reply) => {
    return reply.send({ success: true, data: [] });
  });

  // ── Violations ────────────────────────────────────────────────

  app.get('/:projectId/rules/violations', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const violations = await app.ruleEngine.getViolations(projectId);
    return reply.send({ success: true, data: violations });
  });

  app.patch('/:projectId/rules/violations/:violId', async (request, reply) => {
    const { violId } = request.params as { violId: string };
    await app.ruleEngine.resolveViolation(violId);
    return reply.send({ success: true, data: { message: 'Violation resolved' } });
  });
}
