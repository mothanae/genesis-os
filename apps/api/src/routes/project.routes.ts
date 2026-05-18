import type { FastifyInstance } from 'fastify';
import { createProjectSchema, updateProjectSchema } from '@genesis-1/shared/schemas';
import {
  projects, projectMembers,
  nodes, edges, branches, snapshots, flows, flowExecutions,
  agentDefinitions, executions, executionSteps,
  ruleSets, ruleDefinitions, evaluationResults, violations,
  simulationDefinitions, simulationRuns, simulationEvents,
} from '@genesis-1/database';
import { eq, or, and, sql } from 'drizzle-orm';

export async function projectRoutes(app: FastifyInstance): Promise<void> {

  // List projects
  app.get('/', async (request, reply) => {
    const userId = request.user!.sub;

    const result = await app.db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(sql`${projects.updatedAt} DESC`);

    return reply.send({
      success: true,
      data: result,
      meta: { total: result.length },
    });
  });

  // Create project
  app.post('/', async (request, reply) => {
    const body = createProjectSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const userId = request.user!.sub;
    const { name, description, settings } = body.data;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const result = await app.db
      .insert(projects)
      .values({
        name,
        slug,
        description: description ?? null,
        ownerId: userId,
        settings: settings ?? {},
      })
      .returning();

    const project = result[0]!;

    return reply.status(201).send({ success: true, data: project });
  });

  // Get project
  app.get('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await app.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (result.length === 0) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    return reply.send({ success: true, data: result[0] });
  });

  // Update project
  app.patch('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = updateProjectSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: body.error.flatten(),
      });
    }

    const userId = request.user!.sub;

    // Verify ownership
    const existing = await app.db
      .select({ id: projects.id, ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    if (existing[0]!.ownerId !== userId) {
      return reply.status(403).send({ success: false, error: 'Only the project owner can update it' });
    }

    const updates: Record<string, unknown> = {};
    if (body.data.name !== undefined) {
      updates.name = body.data.name;
      updates.slug = body.data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    if (body.data.description !== undefined) updates.description = body.data.description;
    if (body.data.settings !== undefined) updates.settings = body.data.settings;

    const result = await app.db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, projectId))
      .returning();

    return reply.send({ success: true, data: result[0] });
  });

  // Delete project
  app.delete('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = request.user!.sub;

    const existing = await app.db
      .select({ id: projects.id, ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    if (existing[0]!.ownerId !== userId) {
      return reply.status(403).send({ success: false, error: 'Only the project owner can delete it' });
    }

    // Manual cascade cleanup for tables without FK cascade to projects
    const deleted: Record<string, number> = {};

    // Delete graph data (edges must be deleted before nodes due to FK references)
    const graphEdges = await app.db.delete(edges).where(eq(edges.projectId as never, projectId as never)).returning();
    deleted.edges = graphEdges.length;
    const delFlows = await app.db.select({ id: flows.id }).from(flows).where(eq(flows.projectId as never, projectId as never));
    for (const f of delFlows) {
      await app.db.delete(flowExecutions).where(eq(flowExecutions.flowId as never, f.id as never));
    }
    await app.db.delete(flows).where(eq(flows.projectId as never, projectId as never));
    await app.db.delete(snapshots).where(eq(snapshots.projectId as never, projectId as never));
    await app.db.delete(branches).where(eq(branches.projectId as never, projectId as never));
    const graphNodes = await app.db.delete(nodes).where(eq(nodes.projectId as never, projectId as never)).returning();
    deleted.nodes = graphNodes.length;

    // Delete agent data
    const agentDefs = await app.db.select({ id: agentDefinitions.id }).from(agentDefinitions).where(eq(agentDefinitions.projectId, projectId));
    for (const ad of agentDefs) {
      await app.db.delete(executionSteps).where(eq(executionSteps.executionId as never, ad.id as never));
      await app.db.delete(executions).where(eq(executions.agentId as never, ad.id as never));
    }
    const delAgents = await app.db.delete(agentDefinitions).where(eq(agentDefinitions.projectId as never, projectId as never)).returning();
    deleted.agents = delAgents.length;

    // Delete rule data
    const ruleDefs = await app.db.select({ id: ruleDefinitions.id }).from(ruleDefinitions).where(eq(ruleDefinitions.projectId as never, projectId as never));
    for (const rd of ruleDefs) {
      await app.db.delete(violations).where(eq(violations.ruleId as never, rd.id as never));
      await app.db.delete(evaluationResults).where(eq(evaluationResults.ruleId as never, rd.id as never));
    }
    const delRules = await app.db.delete(ruleDefinitions).where(eq(ruleDefinitions.projectId as never, projectId as never)).returning();
    deleted.rules = delRules.length;
    const delRuleSets = await app.db.delete(ruleSets).where(eq(ruleSets.projectId as never, projectId as never)).returning();
    deleted.ruleSets = delRuleSets.length;

    // Delete simulation data
    const simDefs = await app.db.select({ id: simulationDefinitions.id }).from(simulationDefinitions).where(eq(simulationDefinitions.projectId as never, projectId as never));
    for (const sd of simDefs) {
      const runs = await app.db.select({ id: simulationRuns.id }).from(simulationRuns).where(eq(simulationRuns.definitionId as never, sd.id as never));
      for (const run of runs) {
        await app.db.delete(simulationEvents).where(eq(simulationEvents.runId as never, run.id as never));
      }
      await app.db.delete(simulationRuns).where(eq(simulationRuns.definitionId as never, sd.id as never));
    }
    const delSims = await app.db.delete(simulationDefinitions).where(eq(simulationDefinitions.projectId as never, projectId as never)).returning();
    deleted.simulations = delSims.length;

    // Delete project members
    const delMembers = await app.db.delete(projectMembers).where(eq(projectMembers.projectId as never, projectId as never)).returning();
    deleted.members = delMembers.length;

    // Finally delete the project itself
    await app.db.delete(projects).where(eq(projects.id as never, projectId as never));

    return reply.send({ success: true, data: { message: 'Project deleted', deleted } });
  });

  // ── Project Members ──────────────────────────────────────────────

  // List members
  app.get('/:projectId/members', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await app.db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));

    return reply.send({ success: true, data: result });
  });

  // Add member
  app.post('/:projectId/members', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = request.user!.sub;
    const { memberId, role } = (request.body ?? {}) as { memberId?: string; role?: string };

    if (!memberId) {
      return reply.status(400).send({ success: false, error: 'memberId is required' });
    }

    // Verify ownership
    const existing = await app.db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    if (existing[0]!.ownerId !== userId) {
      return reply.status(403).send({ success: false, error: 'Only the project owner can manage members' });
    }

    const result = await app.db
      .insert(projectMembers)
      .values({
        projectId,
        userId: memberId,
        role: (role as 'owner' | 'admin' | 'editor' | 'viewer') ?? 'editor',
      })
      .returning();

    return reply.status(201).send({ success: true, data: result[0] });
  });

  // Remove member
  app.delete('/:projectId/members/:memberId', async (request, reply) => {
    const { projectId, memberId } = request.params as { projectId: string; memberId: string };
    const userId = request.user!.sub;

    // Verify ownership
    const existing = await app.db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }
    if (existing[0]!.ownerId !== userId) {
      return reply.status(403).send({ success: false, error: 'Only the project owner can manage members' });
    }

    await app.db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)));

    return reply.send({ success: true, data: { message: 'Member removed' } });
  });
}
