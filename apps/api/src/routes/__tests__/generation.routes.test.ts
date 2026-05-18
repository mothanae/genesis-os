import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { generationRoutes } from '../generation.routes';

function createMockApp() {
  const app = Fastify({ logger: false });

  // Mock all engine decorators used by generation routes
  app.decorate('graphEngine', {
    validateTopology: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    listNodes: vi.fn().mockResolvedValue({ data: [] }),
    listEdges: vi.fn().mockResolvedValue([]),
  } as never);

  app.decorate('orchestrator', {
    planFromGraph: vi.fn().mockResolvedValue([
      { type: 'plan', status: 'completed' },
      { type: 'generate_backend', status: 'completed' },
    ]),
    executePlan: vi.fn().mockResolvedValue([
      { type: 'plan', status: 'completed' },
      { type: 'generate_backend', status: 'completed' },
    ]),
  } as never);

  app.decorate('generationEngine', {
    generate: vi.fn().mockResolvedValue({
      success: true,
      modules: [],
      stats: { totalFiles: 0, totalLines: 0 },
      errors: [],
    }),
    generateAndPersist: vi.fn().mockResolvedValue({
      success: true,
      modules: [{ path: 'src/index.ts', language: 'typescript', type: 'backend', content: '// generated' }],
      stats: { totalFiles: 3, totalLines: 150 },
      errors: [],
      persisted: true,
    }),
  } as never);

  app.decorate('deploymentEngine', {
    generateDeployment: vi.fn().mockResolvedValue({
      success: true,
      modules: [{ path: 'docker-compose.yml', type: 'docker', description: 'Docker Compose' }],
      deploymentPlan: { order: [], estimatedMinutes: 2, rollbackPlan: [] },
      errors: [],
    }),
  } as never);

  app.decorate('evolutionEngine', {
    evolve: vi.fn().mockResolvedValue({
      insights: [],
      upgradePaths: [],
      appliedFixes: [],
      templateMatches: [],
      snapshotId: null,
    }),
  } as never);

  return app;
}

describe('Generation Routes', () => {
  let app: ReturnType<typeof createMockApp>;

  beforeEach(async () => {
    app = createMockApp();
    await app.register(websocket);
    await app.register(generationRoutes, { prefix: '/api/v1/projects' });
    await app.ready();
  });

  describe('POST /:projectId/generate', () => {
    it('should generate code with valid body and default target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/generate',
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('modules');
      expect(body.data).toHaveProperty('stats');
    });

    it('should generate code with explicit target stack', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/generate',
        payload: { targetStack: 'react', persist: true },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.persisted).toBe(true);
    });

    it('should return 422 for invalid targetStack', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/generate',
        payload: { targetStack: 'invalid_stack' },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation error');
    });
  });

  describe('POST /:projectId/execute-loop', () => {
    it('should run full execution loop with default parameters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/execute-loop',
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('topology');
      expect(body.data).toHaveProperty('plan');
      expect(body.data).toHaveProperty('execution');
      expect(body.data).toHaveProperty('generation');
      expect(body.data).toHaveProperty('deployment');
      expect(body.data).toHaveProperty('evolution');
    });

    it('should run execution loop with explicit target stack', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/execute-loop',
        payload: { targetStack: 'react' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });

    it('should return 422 for invalid targetStack in execute-loop', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/execute-loop',
        payload: { targetStack: 'python' },
      });

      expect(res.statusCode).toBe(422);
    });

    it('should handle topology validation errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).graphEngine.validateTopology = vi.fn().mockResolvedValue({
        valid: false,
        errors: [{ message: 'Cycle detected', path: 'A->B->A' }],
        warnings: [],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/execute-loop',
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.topology.valid).toBe(false);
    });

    it('should return 422 for invalid body types', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects/test-project/execute-loop',
        payload: { targetStack: 123 },
      });

      expect(res.statusCode).toBe(422);
    });
  });
});
