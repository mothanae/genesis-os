import { describe, it, expect, beforeEach, vi } from 'vitest';

// The env module validates at import time, so we must set env vars before import
describe('env validation', () => {
  beforeEach(() => {
    // Reset modules to pick up fresh env vars
    vi.resetModules();
    // Set required env vars before importing config
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!!';
    process.env.NODE_ENV = 'test';
    process.env.SKIP_ENV_VALIDATION = 'true';
  });

  it('exports env object when SKIP_ENV_VALIDATION is set', async () => {
    const { env } = await import('../env');
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBe('test');
  });

  it('has correct default values', async () => {
    const { env } = await import('../env');
    expect(env.API_PORT).toBe(3001);
    expect(env.API_HOST).toBe('0.0.0.0');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(env.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(env.JWT_REFRESH_EXPIRY).toBe('7d');
    expect(env.DATABASE_POOL_MIN).toBe(2);
    expect(env.DATABASE_POOL_MAX).toBe(20);
  });

  it('uses custom values when set', async () => {
    process.env.API_PORT = '4000';
    process.env.LOG_LEVEL = 'debug';
    process.env.CORS_ORIGIN = 'http://example.com';
    process.env.DATABASE_POOL_MAX = '50';

    const { env } = await import('../env');
    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.CORS_ORIGIN).toBe('http://example.com');
    expect(env.DATABASE_POOL_MAX).toBe(50);
  });

  it('has optional API keys as undefined when not set', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { env } = await import('../env');
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });
});
