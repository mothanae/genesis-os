import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service';
import type { JwtPayload } from '@genesis-1/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload | null;
  }
  interface FastifyInstance {
    authService: AuthService;
  }
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app.db);
  app.decorate('authService', authService);
  app.decorateRequest('user', null);
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header) {
    return reply.status(401).send({
      success: false,
      error: 'Missing authorization header',
    });
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return reply.status(401).send({
      success: false,
      error: 'Invalid authorization header format',
    });
  }

  try {
    const authService = request.server.authService;
    const payload = authService.verifyAccessToken(parts[1]);
    request.user = payload;
  } catch {
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply);
  if (reply.sent) return;

  if (!request.user || request.user.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: 'Admin access required',
    });
  }
}

export async function requireStaff(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply);
  if (reply.sent) return;

  if (
    !request.user ||
    (request.user.role !== 'admin' && request.user.role !== 'moderator')
  ) {
    return reply.status(403).send({
      success: false,
      error: 'Staff access required',
    });
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header) return;

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return;

  try {
    const authService = request.server.authService;
    const payload = authService.verifyAccessToken(parts[1]);
    request.user = payload;
  } catch {
    // Token invalid — continue without auth
  }
}
