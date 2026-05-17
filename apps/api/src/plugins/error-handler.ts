import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/**
 * Global error handler — catches all unhandled errors and returns
 * structured JSON responses with correlation IDs for observability.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((rawError, _request, reply) => {
    if (reply.sent) return;

    const error = rawError as Error & {
      validation?: unknown;
      statusCode?: number;
      code?: string;
    };

    // Zod validation errors → 422
    if (error instanceof ZodError) {
      app.log.warn({ err: error }, 'Validation error');
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: error.flatten(),
      });
    }

    // Fastify validation errors → 422
    if (error.validation) {
      app.log.warn({ err: error }, 'Request validation failed');
      return reply.status(422).send({
        success: false,
        error: 'Validation error',
        details: error.validation,
      });
    }

    // Rate limit → 429
    if (error.statusCode === 429) {
      app.log.warn({ err: error }, 'Rate limit exceeded');
      return reply.status(429).send({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
    }

    // Domain errors (have statusCode property)
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      app.log.warn({ err: error, statusCode: error.statusCode }, 'Domain error');
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
      });
    }

    // Body too large → 413
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.status(413).send({
        success: false,
        error: 'Request body too large',
      });
    }

    // Everything else → 500
    app.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      success: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message || 'Internal server error',
    });
  });
}
