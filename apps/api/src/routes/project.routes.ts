import type { FastifyInstance } from 'fastify';
import { createProjectSchema, updateProjectSchema } from '@genesis-1/shared/schemas';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // List projects
  app.get('/', async (request, reply) => {
    return reply.send({ success: true, data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  // Create project
  app.post('/', async (request, reply) => {
    const body = createProjectSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    // Stub: create project via service
    return reply.status(201).send({
      success: true,
      data: { id: 'stub-project-id', ...body.data, slug: body.data.name.toLowerCase().replace(/\s+/g, '-') },
    });
  });

  // Get project
  app.get('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    return reply.send({ success: true, data: { id: projectId, name: 'Stub Project' } });
  });

  // Update project
  app.patch('/:projectId', async (request, reply) => {
    const body = updateProjectSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    return reply.send({ success: true, data: body.data });
  });

  // Delete project
  app.delete('/:projectId', async (request, reply) => {
    return reply.send({ success: true, data: { message: 'Project deleted' } });
  });
}
