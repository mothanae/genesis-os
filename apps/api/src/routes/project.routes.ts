import type { FastifyInstance } from 'fastify';
import { createProjectSchema, updateProjectSchema } from '@genesis-1/shared/schemas';
import { projects } from '@genesis-1/database';
import { eq, or, and, sql } from 'drizzle-orm';
import { authenticate } from '../plugins/auth';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // All project routes require authentication
  app.addHook('preHandler', authenticate);

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

    await app.db.delete(projects).where(eq(projects.id, projectId));

    return reply.send({ success: true, data: { message: 'Project deleted' } });
  });
}
