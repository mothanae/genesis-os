import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service';
import type { ApiKeyService } from '../services/api-key.service';
import type { JwtPayload } from '@genesis-1/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload | null;
  }
  interface FastifyInstance {
    authService: AuthService;
    apiKeyService: ApiKeyService;
  }
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app.db);
  app.decorate('authService', authService);
  app.decorateRequest('user', null);
}

// ── JWT Bearer Auth ─────────────────────────────────────────

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Try API key first, then JWT Bearer
  const apiKeyHeader = request.headers['x-api-key'] as string | undefined;
  if (apiKeyHeader) {
    await authenticateApiKey(request, reply);
    if (!reply.sent) return;
  }

  const header = request.headers.authorization;
  if (!header) {
    return reply.status(401).send({
      success: false,
      error: 'Missing authorization header or X-API-Key',
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

// ── API Key Auth ────────────────────────────────────────────

/**
 * Authenticate via X-API-Key header.
 * Verifies the key against the database and sets request.user with the key owner's identity.
 * Used by CI/CD pipelines and external services.
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      error: 'Missing X-API-Key header',
    });
  }

  const result = await request.server.apiKeyService.verifyApiKey(apiKey);
  if (!result) {
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired API key',
    });
  }

  // Look up user to get role for authorization checks
  try {
    const user = await request.server.authService.getMe(result.userId);
    request.user = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  } catch {
    return reply.status(401).send({
      success: false,
      error: 'API key owner not found or blocked',
    });
  }
}

// ── Role-Based Guards ───────────────────────────────────────

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

// ── Optional Auth ───────────────────────────────────────────

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // Try API key first
  const apiKeyHeader = request.headers['x-api-key'] as string | undefined;
  if (apiKeyHeader) {
    try {
      const result = await request.server.apiKeyService.verifyApiKey(apiKeyHeader);
      if (result) {
        const user = await request.server.authService.getMe(result.userId);
        request.user = {
          sub: user.id,
          email: user.email,
          role: user.role,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
        return;
      }
    } catch {
      // Continue to JWT attempt
    }
  }

  // Try JWT Bearer
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
