import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema, refreshTokenSchema } from '@genesis-1/shared/schemas';
import { authenticate } from '../plugins/auth';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/register
  app.post('/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    const { email, password, displayName } = result.data;

    try {
      const data = await app.authService.register(email, password, displayName);
      return reply.status(201).send({ success: true, data });
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const domainErr = err as Error & { statusCode: number };
        return reply.status(domainErr.statusCode).send({
          success: false,
          error: domainErr.message,
        });
      }
      throw err;
    }
  });

  // POST /api/v1/auth/login
  app.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    const { email, password } = result.data;

    try {
      const data = await app.authService.login(email, password);
      return reply.send({ success: true, data });
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const domainErr = err as Error & { statusCode: number };
        return reply.status(domainErr.statusCode).send({
          success: false,
          error: domainErr.message,
        });
      }
      throw err;
    }
  });

  // GET /api/v1/auth/me
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ success: false, error: 'Not authenticated' });
    }
    try {
      const user = await app.authService.getMe(request.user.sub);
      return reply.send({ success: true, data: user });
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const domainErr = err as Error & { statusCode: number };
        return reply.status(domainErr.statusCode).send({
          success: false,
          error: domainErr.message,
        });
      }
      throw err;
    }
  });

  // POST /api/v1/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const result = refreshTokenSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }

    try {
      const data = await app.authService.refresh(result.data.refreshToken);
      return reply.send({ success: true, data });
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        const domainErr = err as Error & { statusCode: number };
        return reply.status(domainErr.statusCode).send({
          success: false,
          error: domainErr.message,
        });
      }
      throw err;
    }
  });

  // POST /api/v1/auth/logout
  app.post('/logout', async (request, reply) => {
    const body = request.body as { refreshToken?: string } | undefined;
    if (body?.refreshToken) {
      try {
        await app.authService.logout(body.refreshToken);
      } catch {
        // Logout is best-effort — always succeed
      }
    }
    return reply.send({ success: true, data: { message: 'Logged out' } });
  });
}
