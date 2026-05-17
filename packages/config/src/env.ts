import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .default('info'),

    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MIN: z.coerce.number().int().positive().default(2),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),

    REDIS_URL: z.string().url(),
    REDIS_PREFIX: z.string().default('genesis-1:'),

    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),

    API_PORT: z.coerce.number().int().positive().default(3001),
    API_HOST: z.string().default('0.0.0.0'),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),

    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type Env = typeof env;
