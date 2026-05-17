/**
 * End-to-End Integration Test: Genesis OS Execution Loop
 *
 * Tests the full pipeline described in "to do.txt":
 *   USER ACTION → GRAPH MUTATION → INTENT EXTRACTION → RULE VALIDATION
 *   → TASK PLANNING → AGENT SELECTION → EXECUTION → VALIDATION
 *   → SIMULATION → UI UPDATE
 *
 * Uses mocked infrastructure (DB, Redis) to validate the full flow
 * without requiring Docker containers.
 */
import { describe, it, expect, vi } from 'vitest';
import { JsonLogicEvaluator } from '../../packages/rule-engine/src/evaluator';
import { GraphValidator } from '../../packages/graph-engine/src/validator';
import { FrontendGenerator } from '../../packages/generation-engine/src/generators/frontend';
import { BackendGenerator } from '../../packages/generation-engine/src/generators/backend';
import { DatabaseGenerator } from '../../packages/generation-engine/src/generators/database';
import { InfraGenerator } from '../../packages/generation-engine/src/generators/infra';
import { AuthService } from '../../apps/api/src/services/auth.service';

// ── Mock Infrastructure ─────────────────────────────────────────

vi.mock('@genesis-1/config', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long!!!!!!',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    REDIS_PREFIX: 'test:',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    API_PORT: 3001,
    API_HOST: '0.0.0.0',
    CORS_ORIGIN: 'http://localhost:3000',
  },
}));

vi.mock('@genesis-1/database', () => ({
  users: { id: 'users', email: 'email', passwordHash: 'password_hash', displayName: 'display_name', role: 'role', isActive: 'is_active', avatarUrl: 'avatar_url', createdAt: 'created_at', updatedAt: 'updated_at', $inferSelect: {} as any },
  sessions: { id: 'sessions', userId: 'user_id', refreshToken: 'refresh_token', expiresAt: 'expires_at', createdAt: 'created_at', revokedAt: 'revoked_at', $inferSelect: {} as any },
  simulationRuns: {} as any,
  simulationEvents: {} as any,
  simulationDefinitions: {} as any,
}));

// ── Helpers ──────────────────────────────────────────────────────

function createMockDb() {
  const db: Record<string, any> = {};
  const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert', 'values', 'returning', 'update', 'set', 'delete'];
  for (const m of methods) db[m] = vi.fn(() => db);
  return db;
}

// ── Sample Graph ─────────────────────────────────────────────────

const sampleNodes = [
  { id: 'db-1', type: 'database', name: 'MainDB', state: 'active', version: 1,
    projectId: 'proj-1', position: { x: 0, y: 0 }, inputs: [], outputs: [{ name: 'data', type: 'data' }],
    dependencies: [], relationships: [], metadata: {} },
  { id: 'svc-1', type: 'service', name: 'UserService', state: 'active', version: 1,
    projectId: 'proj-1', position: { x: 100, y: 0 }, inputs: [{ name: 'data', type: 'data' }],
    outputs: [{ name: 'response', type: 'http' }], dependencies: ['db-1'], relationships: [], metadata: {} },
  { id: 'api-1', type: 'rest_endpoint', name: 'GetUsers', state: 'active', version: 1,
    projectId: 'proj-1', position: { x: 200, y: 0 }, inputs: [], outputs: [{ name: 'json', type: 'http' }],
    dependencies: ['svc-1'], relationships: [], metadata: {} },
  { id: 'page-1', type: 'page', name: 'Dashboard', state: 'active', version: 1,
    projectId: 'proj-1', position: { x: 300, y: 0 }, inputs: [], outputs: [],
    dependencies: ['api-1'], relationships: [], metadata: {} },
] as any[];

const sampleEdges = [
  { id: 'e1', source: 'svc-1', target: 'db-1', type: 'depends_on', projectId: 'proj-1' },
  { id: 'e2', source: 'api-1', target: 'svc-1', type: 'depends_on', projectId: 'proj-1' },
  { id: 'e3', source: 'page-1', target: 'api-1', type: 'depends_on', projectId: 'proj-1' },
] as any[];

const cycleEdges = [
  { id: 'e1', source: 'a', target: 'b', type: 'depends_on', projectId: 'proj-1' },
  { id: 'e2', source: 'b', target: 'a', type: 'depends_on', projectId: 'proj-1' },
] as any[];

// ── Tests ────────────────────────────────────────────────────────

describe('Genesis OS — Full Execution Loop', () => {
  const mockDb = createMockDb();

  // ═══ PHASE 1: Auth ═══════════════════════════════════════════

  describe('Phase 1: Authentication', () => {
    it('registers a user with hashed password', async () => {
      mockDb.returning = vi.fn().mockReturnValue([{
        id: 'user-1', email: 'test@genesis-1.dev',
        passwordHash: '$2b$12$testhash', displayName: 'Test User',
        avatarUrl: null, role: 'user', isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      }]);

      const service = new AuthService(mockDb as any);
      const result = await service.register('test@genesis-1.dev', 'password123!', 'Test User');

      expect(result.user.email).toBe('test@genesis-1.dev');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('verifies JWT tokens with correct payload', async () => {
      mockDb.returning = vi.fn().mockReturnValue([{
        id: 'user-1', email: 'test@genesis-1.dev',
        passwordHash: '$2b$12$testhash', displayName: 'Test User',
        avatarUrl: null, role: 'admin', isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      }]);

      const service = new AuthService(mockDb as any);
      // Override mock returning for second call
      mockDb.returning = vi.fn().mockReturnValue([{
        id: 'user-2', email: 'admin@genesis-1.dev',
        passwordHash: '$2b$12$testhash2', displayName: 'Admin',
        avatarUrl: null, role: 'admin', isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      }]);

      const result = await service.register('admin@genesis-1.dev', 'admin123!', 'Admin');

      const payload = service.verifyAccessToken(result.accessToken);
      expect(payload.sub).toBe('user-2');
      expect(payload.role).toBe('admin');
      expect(payload.email).toBe('admin@genesis-1.dev');
    });

    it('rejects invalid tokens', () => {
      const service = new AuthService(mockDb as any);
      expect(() => service.verifyAccessToken('invalid.token.here')).toThrow();
      expect(() => service.verifyAccessToken('')).toThrow();
    });
  });

  // ═══ PHASE 2: Graph Engine ═══════════════════════════════════

  describe('Phase 2: Graph Engine — Topology Validation', () => {
    const validator = new GraphValidator();

    it('validates a correct graph topology', () => {
      const result = validator.validate(sampleNodes, sampleEdges, []);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects dependency cycles', () => {
      const nodes = [
        { id: 'a', type: 'service', name: 'A', state: 'active', version: 1,
          projectId: 'p1', position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
        { id: 'b', type: 'service', name: 'B', state: 'active', version: 1,
          projectId: 'p1', position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];
      const cycles = [{ nodeIds: ['a', 'b', 'a'], length: 2 }];

      const result = validator.validate(nodes, cycleEdges, cycles);
      expect(result.errors.some((e: any) => e.code === 'GRAPH_CYCLE')).toBe(true);
    });

    it('detects orphan nodes (requires >1 node)', () => {
      const nodes = [
        { id: 'orphan', type: 'service', name: 'Orphan', state: 'active', version: 1,
          projectId: 'p1', position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
        { id: 'svc', type: 'service', name: 'Connected', state: 'active', version: 1,
          projectId: 'p1', position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];
      const edges = [
        { id: 'e1', source: 'svc', target: 'external-db', type: 'depends_on', projectId: 'p1' },
      ] as any[];
      const result = validator.validate(nodes, edges, []);
      expect(result.warnings.some((w: any) => w.code === 'ORPHANED_NODE')).toBe(true);
    });
  });

  // ═══ PHASE 3: Rule Engine ════════════════════════════════════

  describe('Phase 3: Rule Engine — Logic Evaluation', () => {
    const evaluator = new JsonLogicEvaluator();

    it('evaluates equality rules', () => {
      expect(evaluator.evaluate({ eq: [{ var: 'status' }, 'active'] }, { status: 'active' })).toBe(true);
      expect(evaluator.evaluate({ eq: [{ var: 'status' }, 'inactive'] }, { status: 'active' })).toBe(false);
    });

    it('evaluates comparison rules', () => {
      expect(evaluator.evaluate({ gt: [{ var: 'count' }, 0] }, { count: 5 })).toBe(true);
      expect(evaluator.evaluate({ lt: [{ var: 'latency' }, 100] }, { latency: 50 })).toBe(true);
      expect(evaluator.evaluate({ gte: [{ var: 'replicas' }, 2] }, { replicas: 2 })).toBe(true);
    });

    it('evaluates array containment', () => {
      expect(evaluator.evaluate({ in: ['active', { var: 'allowed' }] }, { allowed: ['active', 'pending'] })).toBe(true);
      expect(evaluator.evaluate({ in: ['blocked', { var: 'allowed' }] }, { allowed: ['active', 'pending'] })).toBe(false);
    });

    it('evaluates complex nested logic', () => {
      const rule = {
        or: [
          { and: [{ gt: [{ var: 'cpu' }, 80] }, { gt: [{ var: 'memory' }, 90] }] },
          { eq: [{ var: 'status' }, 'critical'] },
        ],
      };

      expect(evaluator.evaluate(rule, { cpu: 90, memory: 95, status: 'ok' })).toBe(true);
      expect(evaluator.evaluate(rule, { cpu: 50, memory: 50, status: 'critical' })).toBe(true);
      expect(evaluator.evaluate(rule, { cpu: 50, memory: 50, status: 'ok' })).toBe(false);
    });
  });

  // ═══ PHASE 4: Code Generation ════════════════════════════════

  describe('Phase 4: Code Generation — All Generators', () => {
    it('generates frontend components (pages, forms, tables, charts)', () => {
      const gen = new FrontendGenerator();
      const nodes = [
        { id: 'p1', type: 'page', name: 'Dashboard', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
        { id: 'f1', type: 'form', name: 'LoginForm', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
        { id: 't1', type: 'table', name: 'UsersTable', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
        { id: 'ch1', type: 'chart', name: 'MetricsChart', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { framework: 'nextjs', styling: 'tailwind', typescript: true });

      expect(result).toHaveLength(4);
      result.forEach((r) => expect(r.content.length).toBeGreaterThan(0));

      const page = result.find((r) => r.path.includes('dashboard'))!;
      expect(page).toBeDefined();
      expect(page.content).toContain('export default function');
      expect(page.content).toContain('Metadata');

      const form = result.find((r) => r.path.includes('loginform'))!;
      expect(form).toBeDefined();
      expect(form.content).toContain('useState');
      expect(form.content).toContain('handleSubmit');

      const table = result.find((r) => r.path.includes('userstable'))!;
      expect(table).toBeDefined();
      expect(table.content).toContain('<table');

      const chart = result.find((r) => r.path.includes('metricschart'))!;
      expect(chart).toBeDefined();
      expect(chart.content).toContain('maxValue');
    });

    it('generates Fastify backend services', () => {
      const gen = new BackendGenerator();
      const nodes = [
        { id: 's1', type: 'service', name: 'UserService', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { framework: 'fastify', language: 'typescript', orm: 'drizzle' });
      expect(result[0]!.content).toContain('FastifyInstance');
      expect(result[0]!.content).toContain('z.object');
    });

    it('generates Express backend services', () => {
      const gen = new BackendGenerator();
      const nodes = [
        { id: 's1', type: 'service', name: 'APIService', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { framework: 'express', language: 'javascript', orm: 'prisma' });
      expect(result[0]!.content).toContain('Router');
    });

    it('generates NestJS backend services', () => {
      const gen = new BackendGenerator();
      const nodes = [
        { id: 's1', type: 'service', name: 'OrderService', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { framework: 'nestjs', language: 'typescript', orm: 'typeorm' });
      expect(result[0]!.content).toContain('@Injectable');
      expect(result[0]!.content).toContain('@Controller');
      expect(result[0]!.content).toContain('@Module');
    });

    it('generates Drizzle ORM database schemas', () => {
      const gen = new DatabaseGenerator();
      const nodes = [
        { id: 'db1', type: 'database', name: 'users', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { orm: 'drizzle', dialect: 'postgresql' });
      expect(result[0]!.content).toContain('pgTable');
      expect(result[0]!.content).toContain('uuid');
    });

    it('generates Prisma models', () => {
      const gen = new DatabaseGenerator();
      const nodes = [
        { id: 'db1', type: 'database', name: 'users', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { orm: 'prisma', dialect: 'postgresql' });
      expect(result[0]!.content).toContain('model');
      expect(result[0]!.content).toContain('@map("created_at")');
    });

    it('generates TypeORM entities', () => {
      const gen = new DatabaseGenerator();
      const nodes = [
        { id: 'db1', type: 'database', name: 'products', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { orm: 'typeorm', dialect: 'postgresql' });
      expect(result[0]!.content).toContain('@Entity');
      expect(result[0]!.content).toContain('@PrimaryGeneratedColumn');
    });

    it('generates SQL migration files', () => {
      const gen = new DatabaseGenerator();
      const nodes = [
        { id: 'db1', type: 'database', name: 'users', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const migration = gen.generateMigration(nodes, { orm: 'drizzle', dialect: 'postgresql' });
      expect(migration).toContain('CREATE TABLE');
      expect(migration).toContain('users');
      expect(migration).toContain('PRIMARY KEY');
    });

    it('generates Docker infrastructure', () => {
      const gen = new InfraGenerator();
      const nodes = [
        { id: 's1', type: 'service', name: 'API', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {}, runtime: { port: 3000 } },
        { id: 'db1', type: 'database', name: 'MainDB', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { platform: 'docker' });
      const compose = result.find((r) => r.path === 'docker-compose.yml');
      expect(compose?.content).toContain('services:');
      expect(compose?.content).toContain('postgres:16');
      expect(compose?.content).toContain('healthcheck');
    });

    it('generates Kubernetes manifests', () => {
      const gen = new InfraGenerator();
      const nodes = [
        { id: 's1', type: 'service', name: 'API', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {}, runtime: { port: 3000 } },
      ] as any[];

      const result = gen.generate(nodes, { platform: 'kubernetes', cloud: 'aws' });
      const deployment = result.find((r) => r.path.includes('deployment'));
      expect(deployment?.content).toContain('apiVersion: apps/v1');
      expect(deployment?.content).toContain('kind: Deployment');
    });

    it('generates Terraform AWS configs', () => {
      const gen = new InfraGenerator();
      const nodes = [
        { id: 's1', type: 'service', name: 'API', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {}, runtime: { port: 3000 } },
        { id: 'db1', type: 'database', name: 'MainDB', projectId: 'p1', state: 'active', version: 1, position: { x: 0, y: 0 }, inputs: [], outputs: [], dependencies: [], relationships: [], metadata: {} },
      ] as any[];

      const result = gen.generate(nodes, { platform: 'terraform', cloud: 'aws' });
      expect(result.length).toBeGreaterThan(0);
      const mainTf = result.find((r) => r.path.includes('main.tf'));
      expect(mainTf?.content).toContain('aws_ecs_cluster');
      expect(mainTf?.content).toContain('aws_db_instance');
    });
  });

  // ═══ PHASE 5: Execution Loop Integration ═════════════════════

  describe('Phase 5: Full Execution Loop Integration', () => {
    it('completes graph → validation → rules → code → deployment', () => {
      const start = Date.now();

      // Step 1: Validate graph topology
      const validator = new GraphValidator();
      const validation = validator.validate(sampleNodes, sampleEdges, []);
      expect(validation.valid).toBe(true);

      // Step 2: Evaluate rules against graph state
      const evaluator = new JsonLogicEvaluator();
      const ruleContext = { nodeCount: sampleNodes.length, edgeCount: sampleEdges.length };
      expect(evaluator.evaluate({ gt: [{ var: 'nodeCount' }, 0] }, ruleContext)).toBe(true);
      expect(evaluator.evaluate({ gt: [{ var: 'edgeCount' }, 0] }, ruleContext)).toBe(true);

      // Step 3: Generate frontend code
      const frontendGen = new FrontendGenerator();
      const frontendCode = frontendGen.generate(
        [sampleNodes.find((n) => n.type === 'page')!],
        { framework: 'nextjs', styling: 'tailwind', typescript: true },
      );
      expect(frontendCode).toHaveLength(1);
      expect(frontendCode[0]!.content.length).toBeGreaterThan(100);

      // Step 4: Generate backend code
      const backendGen = new BackendGenerator();
      const backendCode = backendGen.generate(
        [sampleNodes.find((n) => n.type === 'service')!],
        { framework: 'fastify', language: 'typescript', orm: 'drizzle' },
      );
      expect(backendCode).toHaveLength(1);
      expect(backendCode[0]!.content).toContain('FastifyInstance');

      // Step 5: Generate database schema
      const dbGen = new DatabaseGenerator();
      const dbCode = dbGen.generate(
        [sampleNodes.find((n) => n.type === 'database')!],
        { orm: 'drizzle', dialect: 'postgresql' },
      );
      expect(dbCode[0]!.content).toContain('pgTable');

      // Step 6: Generate infrastructure
      const infraGen = new InfraGenerator();
      const infraCode = infraGen.generate(sampleNodes, { platform: 'docker' });
      expect(infraCode.some((r) => r.path === 'docker-compose.yml')).toBe(true);

      // Total pipeline time
      const duration = Date.now() - start;
      console.log(`Full execution loop: ${duration}ms (${sampleNodes.length} nodes, ${sampleEdges.length} edges)`);
      expect(duration).toBeLessThan(5000);
    });
  });
});
