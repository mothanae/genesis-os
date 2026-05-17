import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from '@genesis-1/shared/schemas';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    const { email, password, displayName } = body.data;
    // Stub: delegate to auth service
    return reply.status(201).send({
      success: true,
      data: { message: 'User registered', email, displayName },
    });
  });

  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    const { email, password } = body.data;
    // Stub: delegate to auth service
    return reply.send({
      success: true,
      data: { message: 'Login successful', email },
    });
  });

  // Get current user
  app.get('/me', async (request, reply) => {
    // Stub: extract user from JWT
    return reply.send({
      success: true,
      data: { id: 'stub-user', email: 'stub@genesis-1.dev', role: 'admin' },
    });
  });

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    return reply.send({ success: true, data: { message: 'Token refreshed' } });
  });

  // Logout
  app.post('/logout', async (request, reply) => {
    return reply.send({ success: true, data: { message: 'Logged out' } });
  });
}
