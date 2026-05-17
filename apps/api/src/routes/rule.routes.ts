import type { FastifyInstance } from 'fastify';
import {
  createRuleSchema,
  createRuleSetSchema,
  updateRuleSchema,
  updateRuleSetSchema,
  evaluateRuleSchema,
} from '@genesis-1/shared/schemas';
import { ruleSets, ruleDefinitions } from '@genesis-1/database';
import { eq, and, sql } from 'drizzle-orm';

export async function ruleRoutes(app: FastifyInstance): Promise<void> {
  // ── Rule Sets ─────────────────────────────────────────────────

  // List rule sets
  app.get('/:projectId/rules/sets', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await app.db
      .select()
      .from(ruleSets)
      .where(eq(ruleSets.projectId, projectId))
      .orderBy(sql`${ruleSets.updatedAt} DESC`);

    return reply.send({
      success: true,
      data: result,
      meta: { total: result.length },
    });
  });

  // Create rule set
  app.post('/:projectId/rules/sets', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = createRuleSetSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const result = await app.db
      .insert(ruleSets)
      .values({
        projectId,
        name: body.data.name,
        description: body.data.description ?? null,
        evaluationStrategy: body.data.evaluationStrategy ?? 'all-match',
      })
      .returning();

    return reply.status(201).send({ success: true, data: result[0] });
  });

  // Get rule set
  app.get('/:projectId/rules/sets/:setId', async (request, reply) => {
    const { projectId, setId } = request.params as { projectId: string; setId: string };

    const result = await app.db
      .select()
      .from(ruleSets)
      .where(and(eq(ruleSets.id, setId), eq(ruleSets.projectId, projectId)))
      .limit(1);

    if (result.length === 0) {
      return reply.status(404).send({ success: false, error: 'Rule set not found' });
    }

    return reply.send({ success: true, data: result[0] });
  });

  // Update rule set
  app.patch('/:projectId/rules/sets/:setId', async (request, reply) => {
    const { projectId, setId } = request.params as { projectId: string; setId: string };
    const body = updateRuleSetSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const existing = await app.db
      .select({ id: ruleSets.id })
      .from(ruleSets)
      .where(and(eq(ruleSets.id, setId), eq(ruleSets.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Rule set not found' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.data.name !== undefined) updates.name = body.data.name;
    if (body.data.description !== undefined) updates.description = body.data.description;
    if (body.data.evaluationStrategy !== undefined) updates.evaluationStrategy = body.data.evaluationStrategy;
    if (body.data.enabled !== undefined) updates.enabled = body.data.enabled;

    const result = await app.db
      .update(ruleSets)
      .set(updates)
      .where(and(eq(ruleSets.id, setId), eq(ruleSets.projectId, projectId)))
      .returning();

    return reply.send({ success: true, data: result[0] });
  });

  // Delete rule set
  app.delete('/:projectId/rules/sets/:setId', async (request, reply) => {
    const { projectId, setId } = request.params as { projectId: string; setId: string };

    const existing = await app.db
      .select({ id: ruleSets.id })
      .from(ruleSets)
      .where(and(eq(ruleSets.id, setId), eq(ruleSets.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Rule set not found' });
    }

    await app.db
      .delete(ruleSets)
      .where(and(eq(ruleSets.id, setId), eq(ruleSets.projectId, projectId)));

    return reply.send({ success: true, data: { message: 'Rule set deleted' } });
  });

  // ── Rules ─────────────────────────────────────────────────────

  // List rules
  app.get('/:projectId/rules', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await app.db
      .select()
      .from(ruleDefinitions)
      .where(eq(ruleDefinitions.projectId, projectId))
      .orderBy(sql`${ruleDefinitions.priority} ASC, ${ruleDefinitions.updatedAt} DESC`);

    return reply.send({
      success: true,
      data: result,
      meta: { total: result.length },
    });
  });

  // Create rule
  app.post('/:projectId/rules', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = createRuleSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const result = await app.db
      .insert(ruleDefinitions)
      .values({
        projectId,
        ruleSetId: body.data.ruleSetId ?? null,
        name: body.data.name,
        description: body.data.description ?? null,
        domain: body.data.domain,
        condition: body.data.condition,
        action: body.data.action,
        priority: body.data.priority ?? 100,
        evaluationMode: body.data.evaluationMode ?? 'sync',
      })
      .returning();

    return reply.status(201).send({ success: true, data: result[0] });
  });

  // Get rule
  app.get('/:projectId/rules/:ruleId', async (request, reply) => {
    const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };

    const result = await app.db
      .select()
      .from(ruleDefinitions)
      .where(and(eq(ruleDefinitions.id, ruleId), eq(ruleDefinitions.projectId, projectId)))
      .limit(1);

    if (result.length === 0) {
      return reply.status(404).send({ success: false, error: 'Rule not found' });
    }

    return reply.send({ success: true, data: result[0] });
  });

  // Update rule
  app.patch('/:projectId/rules/:ruleId', async (request, reply) => {
    const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };
    const body = updateRuleSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const existing = await app.db
      .select({ id: ruleDefinitions.id })
      .from(ruleDefinitions)
      .where(and(eq(ruleDefinitions.id, ruleId), eq(ruleDefinitions.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Rule not found' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.data.name !== undefined) updates.name = body.data.name;
    if (body.data.description !== undefined) updates.description = body.data.description;
    if (body.data.condition !== undefined) updates.condition = body.data.condition;
    if (body.data.action !== undefined) updates.action = body.data.action;
    if (body.data.enabled !== undefined) updates.enabled = body.data.enabled;
    if (body.data.priority !== undefined) updates.priority = body.data.priority;
    if (body.data.ruleSetId !== undefined) updates.ruleSetId = body.data.ruleSetId;
    if (body.data.evaluationMode !== undefined) updates.evaluationMode = body.data.evaluationMode;

    const result = await app.db
      .update(ruleDefinitions)
      .set(updates)
      .where(and(eq(ruleDefinitions.id, ruleId), eq(ruleDefinitions.projectId, projectId)))
      .returning();

    return reply.send({ success: true, data: result[0] });
  });

  // Delete rule
  app.delete('/:projectId/rules/:ruleId', async (request, reply) => {
    const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };

    const existing = await app.db
      .select({ id: ruleDefinitions.id })
      .from(ruleDefinitions)
      .where(and(eq(ruleDefinitions.id, ruleId), eq(ruleDefinitions.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Rule not found' });
    }

    await app.db
      .delete(ruleDefinitions)
      .where(and(eq(ruleDefinitions.id, ruleId), eq(ruleDefinitions.projectId, projectId)));

    return reply.send({ success: true, data: { message: 'Rule deleted' } });
  });

  // ── Evaluation ────────────────────────────────────────────────

  // Evaluate single rule
  app.post('/:projectId/rules/:ruleId/evaluate', async (request, reply) => {
    const { ruleId } = request.params as { ruleId: string };
    const body = evaluateRuleSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const result = await app.ruleEngine.evaluateRule(ruleId, body.data.facts);
    return reply.send({ success: true, data: result });
  });

  // Evaluate batch
  app.post('/:projectId/rules/evaluate-batch', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const rules = await app.db
      .select()
      .from(ruleDefinitions)
      .where(and(eq(ruleDefinitions.projectId, projectId), eq(ruleDefinitions.enabled, true)));

    const facts = ((request.body as Record<string, unknown>).facts ?? {}) as Record<string, unknown>;

    const results = [];
    for (const rule of rules) {
      const result = await app.ruleEngine.evaluateRule(rule.id, facts);
      results.push(result);
    }

    return reply.send({ success: true, data: results });
  });

  // ── Violations ────────────────────────────────────────────────

  // Get violations
  app.get('/:projectId/rules/violations', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await app.ruleEngine.getViolations(projectId);
    return reply.send({ success: true, data: result });
  });

  // Resolve violation
  app.patch('/:projectId/rules/violations/:violId', async (request, reply) => {
    const { violId } = request.params as { violId: string };
    await app.ruleEngine.resolveViolation(violId);
    return reply.send({ success: true, data: { message: 'Violation resolved' } });
  });
}
