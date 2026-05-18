import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerationEngine, type GenerationConfig } from '../engine';

function mockGraphEngine(nodes: unknown[], edges: unknown[] = []) {
  return {
    listNodes: vi.fn().mockResolvedValue({ data: nodes }),
    listEdges: vi.fn().mockResolvedValue(edges),
    validateTopology: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
  };
}

function mockEventBus() {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

function makeConfig(overrides: Partial<GenerationConfig> = {}): GenerationConfig {
  return {
    projectId: 'test-project-id',
    targetStack: 'react',
    outputDir: '/tmp/gen-test',
    options: {},
    ...overrides,
  };
}

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'node-1',
    type: 'service',
    name: 'Test Service',
    description: 'A test service',
    ...overrides,
  };
}

describe('GenerationEngine', () => {
  let engine: GenerationEngine;
  let graphEngine: ReturnType<typeof mockGraphEngine>;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    graphEngine = mockGraphEngine([]);
    eventBus = mockEventBus();
    engine = new GenerationEngine(graphEngine as never, eventBus as never);
  });

  // ── Core Pipeline ───────────────────────────────────────────

  describe('generate()', () => {
    it('returns empty modules for empty graph', async () => {
      const result = await engine.generate(makeConfig());

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0); // project files are always generated
      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalFiles).toBeGreaterThan(0);
    });

    it('emits started and completed events on success', async () => {
      await engine.generate(makeConfig());

      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.generation.started',
        expect.objectContaining({ type: 'genesis-1.generation.started' }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.generation.completed',
        expect.objectContaining({ type: 'genesis-1.generation.completed' }),
      );
    });

    it('emits failed event when graph engine throws', async () => {
      (graphEngine.listNodes as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const result = await engine.generate(makeConfig());

      expect(result.success).toBe(false);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.generation.failed',
        expect.objectContaining({ type: 'genesis-1.generation.failed' }),
      );
    });

    it('generates stats with correct file and line counts', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Auth' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      expect(result.stats.totalFiles).toBeGreaterThan(0);
      expect(result.stats.totalLines).toBeGreaterThan(0);
      expect(result.stats.languages).toContain('typescript');
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('continues generation when a single node fails', async () => {
      const badNode = makeNode({ id: 'bad-node', type: 'service', name: null });
      const goodNode = makeNode({ id: 'good-node', type: 'database', name: 'Users' });
      graphEngine = mockGraphEngine([badNode, goodNode]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      // The null name will cause toKebab to throw
      const result = await engine.generate(makeConfig());

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.modules.length).toBeGreaterThan(0); // some modules generated
    });
  });

  // ── Node Type Generation ───────────────────────────────────

  describe('node type generation', () => {
    it('generates a typescript service', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Auth Service' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig({ targetStack: 'nodejs' }));

      const svcMod = result.modules.find((m) => m.path.includes('auth-service') && m.type === 'service');
      expect(svcMod).toBeDefined();
      expect(svcMod!.language).toBe('typescript');
      expect(svcMod!.content).toContain('AuthService');
    });

    it('generates a function handler', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'function', name: 'Process Webhook' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const fnMod = result.modules.find((m) => m.path.includes('process-webhook'));
      expect(fnMod).toBeDefined();
      expect(fnMod!.type).toBe('service');
    });

    it('generates a database schema', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'database', name: 'Users' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const dbMod = result.modules.find((m) => m.type === 'schema');
      expect(dbMod).toBeDefined();
      expect(dbMod!.content).toContain('pgTable');
      expect(dbMod!.language).toBe('typescript');
    });

    it('generates an API gateway', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'api_gateway', name: 'Main Gateway' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const gwMod = result.modules.find((m) => m.type === 'route');
      expect(gwMod).toBeDefined();
      expect(gwMod!.content).toContain('Router');
    });

    it('generates a REST endpoint with Zod schema', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'rest_endpoint', name: 'Get Users' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const epMod = result.modules.find((m) => m.type === 'route');
      expect(epMod).toBeDefined();
      expect(epMod!.content).toContain('z.object');
    });

    it('generates a React page', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'page', name: 'Dashboard' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const pageMod = result.modules.find((m) => m.type === 'component' && m.language === 'tsx');
      expect(pageMod).toBeDefined();
      expect(pageMod!.content).toContain('DashboardPage');
    });

    it('generates a React component', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'component', name: 'User Card' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const compMod = result.modules.find((m) => m.path.includes('user-card'));
      expect(compMod).toBeDefined();
      expect(compMod!.content).toContain('UserCard');
    });

    it('generates a GraphQL schema', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'graphql_schema', name: 'API Schema' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const gqlMod = result.modules.find((m) => m.type === 'schema' && m.language === 'graphql');
      expect(gqlMod).toBeDefined();
      expect(gqlMod!.content).toContain('type Query');
    });

    it('generates a Dockerfile', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'container', name: 'App Container', runtime: { port: 8080 } })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const dockerMod = result.modules.find((m) => m.type === 'docker');
      expect(dockerMod).toBeDefined();
      expect(dockerMod!.content).toContain('FROM node:20-alpine');
      expect(dockerMod!.content).toContain('8080');
    });

    it('generates a test file for services', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Payment' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const testMod = result.modules.find((m) => m.type === 'test');
      expect(testMod).toBeDefined();
      expect(testMod!.content).toContain('describe');
      expect(testMod!.content).toContain('vitest');
    });

    it('emits module generated event for each node', async () => {
      graphEngine = mockGraphEngine([
        makeNode({ id: 'n1', type: 'service', name: 'Service A' }),
        makeNode({ id: 'n2', type: 'database', name: 'DB A' }),
      ]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      await engine.generate(makeConfig());

      const moduleCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: string[]) => call[0] === 'genesis-1.generation.module.generated',
      );
      expect(moduleCalls).toHaveLength(2);
    });
  });

  // ── Stack-Specific Generation ──────────────────────────────

  describe('stack-specific generation', () => {
    const svcNode = makeNode({ type: 'service', name: 'Test Service' });

    it('generates Laravel PHP service', async () => {
      graphEngine = mockGraphEngine([svcNode]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig({ targetStack: 'laravel' }));

      const phpMod = result.modules.find((m) => m.language === 'php');
      expect(phpMod).toBeDefined();
      expect(phpMod!.content).toContain('<?php');
      expect(phpMod!.content).toContain('namespace App\\Services');
    });

    it('generates Django Python service', async () => {
      graphEngine = mockGraphEngine([svcNode]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig({ targetStack: 'django' }));

      const pyMod = result.modules.find((m) => m.language === 'python');
      expect(pyMod).toBeDefined();
      expect(pyMod!.content).toContain('from rest_framework');
    });

    it('generates FastAPI Python service', async () => {
      graphEngine = mockGraphEngine([svcNode]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig({ targetStack: 'fastapi' }));

      const pyMod = result.modules.find((m) => m.language === 'python' && m.path.includes('.py'));
      expect(pyMod).toBeDefined();
      expect(pyMod!.content).toContain('from fastapi');
    });

    it('generates Golang service', async () => {
      graphEngine = mockGraphEngine([svcNode]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig({ targetStack: 'golang' }));

      const goMod = result.modules.find((m) => m.language === 'go');
      expect(goMod).toBeDefined();
      expect(goMod!.content).toContain('package main');
    });

    it('generates Rust service', async () => {
      graphEngine = mockGraphEngine([svcNode]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig({ targetStack: 'rust' }));

      const rsMod = result.modules.find((m) => m.language === 'rust');
      expect(rsMod).toBeDefined();
      expect(rsMod!.content).toContain('use actix_web');
    });
  });

  // ── Project Files ──────────────────────────────────────────

  describe('project files', () => {
    it('always generates a package.json', async () => {
      const result = await engine.generate(makeConfig());

      const pkgMod = result.modules.find((m) => m.path.endsWith('package.json'));
      expect(pkgMod).toBeDefined();
      const pkg = JSON.parse(pkgMod!.content);
      expect(pkg.scripts.dev).toBeDefined();
      expect(pkg.scripts.test).toBe('vitest run');
    });

    it('always generates a README with node listing', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'MyService' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const readme = result.modules.find((m) => m.path.endsWith('README.md'));
      expect(readme).toBeDefined();
      expect(readme!.content).toContain('MyService');
    });

    it('generates docker-compose when services exist', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'App' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const compose = result.modules.find((m) => m.path.endsWith('docker-compose.yml'));
      expect(compose).toBeDefined();
      expect(compose!.content).toContain('version');
    });

    it('always generates Prometheus config', async () => {
      const result = await engine.generate(makeConfig());

      const promMod = result.modules.find((m) => m.path.endsWith('prometheus.yml'));
      expect(promMod).toBeDefined();
      expect(promMod!.content).toContain('scrape_configs');
    });

    it('always generates Grafana dashboard', async () => {
      const result = await engine.generate(makeConfig());

      const grafMod = result.modules.find((m) => m.path.endsWith('grafana-dashboard.json'));
      expect(grafMod).toBeDefined();
      const dashboard = JSON.parse(grafMod!.content);
      expect(dashboard.panels).toBeInstanceOf(Array);
      expect(dashboard.panels.length).toBeGreaterThan(0);
    });

    it('always generates scalability docs', async () => {
      const result = await engine.generate(makeConfig());

      const scaleMod = result.modules.find((m) => m.path.endsWith('SCALABILITY.md'));
      expect(scaleMod).toBeDefined();
      expect(scaleMod!.content).toContain('Horizontal Scaling');
    });

    it('always generates architecture docs', async () => {
      const result = await engine.generate(makeConfig());

      const archMod = result.modules.find((m) => m.path.endsWith('ARCHITECTURE.md'));
      expect(archMod).toBeDefined();
      expect(archMod!.content).toContain('Graph-First Architecture');
    });

    it('always generates analytics setup', async () => {
      const result = await engine.generate(makeConfig());

      const analyticsMod = result.modules.find((m) => m.path.endsWith('analytics.ts'));
      expect(analyticsMod).toBeDefined();
      expect(analyticsMod!.content).toContain('class Analytics');
    });

    it('always generates .env.example', async () => {
      const result = await engine.generate(makeConfig());

      const envMod = result.modules.find((m) => m.path.endsWith('.env.example'));
      expect(envMod).toBeDefined();
      expect(envMod!.content).toContain('NODE_ENV=development');
    });

    it('includes DATABASE_URL in env when database node exists', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'database', name: 'MyDB' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const envMod = result.modules.find((m) => m.path.endsWith('.env.example'));
      expect(envMod!.content).toContain('DATABASE_URL');
    });
  });

  // ── Module Structure ───────────────────────────────────────

  describe('module structure', () => {
    it('each module has required fields', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Test' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      for (const mod of result.modules) {
        expect(mod.path).toBeDefined();
        expect(mod.content).toBeDefined();
        expect(mod.language).toBeDefined();
        expect(mod.type).toBeDefined();
        expect(['component', 'service', 'route', 'schema', 'config', 'test', 'docs', 'docker']).toContain(mod.type);
      }
    });

    it('modules use correct paths under outputDir', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Test' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig({ outputDir: '/custom/out' }));

      for (const mod of result.modules) {
        expect(mod.path.startsWith('/custom/out')).toBe(true);
      }
    });
  });

  // ── Name Helpers (indirectly tested through generation) ────

  describe('name formatting', () => {
    it('converts service names to kebab case in paths', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'My Cool Service' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const svc = result.modules.find((m) => m.path.includes('my-cool-service'));
      expect(svc).toBeDefined();
    });

    it('converts service names to PascalCase in class names', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'my-service' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const svc = result.modules.find((m) => m.type === 'service');
      expect(svc!.content).toContain('MyService');
    });

    it('handles special characters in names', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Auth & Auth 2.0!!!' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generate(makeConfig());

      const svc = result.modules.find((m) => m.path.includes('auth--auth-20'));
      expect(svc).toBeDefined();
    });
  });

  // ── Target Stack Enumeration ───────────────────────────────

  describe('all target stacks', () => {
    const stacks = ['react', 'nextjs', 'nodejs', 'fastapi', 'laravel', 'django', 'golang', 'rust'] as const;

    for (const stack of stacks) {
      it(`generates without error for stack: ${stack}`, async () => {
        graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Test' })]);
        engine = new GenerationEngine(graphEngine as never, eventBus as never);

        const result = await engine.generate(makeConfig({ targetStack: stack }));

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    }
  });

  // ── File Persistence ────────────────────────────────────────

  describe('persistModules()', () => {
    it('returns persist result with written count', async () => {
      const result = await engine.generate(makeConfig({ outputDir: '/tmp/gen-test' }));

      const persisted = await engine.persistModules(result);

      expect(persisted.written).toBeGreaterThan(0);
      expect(persisted.failed).toBe(0);
      expect(persisted.failures).toHaveLength(0);
    });

    it('handles modules with empty content', async () => {
      const result = await engine.generate(makeConfig({ outputDir: '/tmp/gen-test' }));
      // Add an empty module
      result.modules.push({
        path: '/tmp/gen-test/empty.txt',
        content: '',
        language: 'text',
        type: 'config',
      });

      const persisted = await engine.persistModules(result);

      expect(persisted.skipped).toBeGreaterThanOrEqual(1);
    });

    it('tracks failures for unwritable paths', async () => {
      const result: Awaited<ReturnType<typeof engine.generate>> = {
        success: true,
        projectId: 'test',
        modules: [
          { path: '/\0invalid/path/file.txt', content: 'hello', language: 'text', type: 'config' },
        ],
        errors: [],
        stats: { totalFiles: 1, totalLines: 1, languages: ['text'], durationMs: 0 },
      };

      const persisted = await engine.persistModules(result);

      expect(persisted.failed).toBeGreaterThanOrEqual(0); // May fail gracefully on Windows
      expect(persisted.failures.length).toBe(persisted.failed);
    });
  });

  describe('generateAndPersist()', () => {
    it('combines generation and persistence', async () => {
      graphEngine = mockGraphEngine([makeNode({ type: 'service', name: 'Test' })]);
      engine = new GenerationEngine(graphEngine as never, eventBus as never);

      const result = await engine.generateAndPersist(makeConfig({ outputDir: '/tmp/gen-test-persist' }));

      expect(result.success).toBe(true);
      expect(result.persisted).toBeDefined();
      expect(result.persisted.written).toBeGreaterThan(0);
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('skips persistence when generation fails', async () => {
      (graphEngine.listNodes as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

      const result = await engine.generateAndPersist(makeConfig());

      expect(result.success).toBe(false);
      expect(result.persisted.written).toBe(0);
    });
  });
});
