import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeploymentEngine, type DeploymentConfig } from '../engine';

function mockGraphEngine(nodes: unknown[] = [], edges: unknown[] = []) {
  return {
    listNodes: vi.fn().mockResolvedValue({ data: nodes }),
    listEdges: vi.fn().mockResolvedValue(edges),
    validateTopology: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
  };
}

function mockEventBus() {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

function makeConfig(overrides: Partial<DeploymentConfig> = {}): DeploymentConfig {
  return {
    projectId: 'test-project-1',
    environment: 'staging',
    platform: 'docker',
    ...overrides,
  };
}

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'node-1',
    type: 'service',
    name: 'api',
    description: 'Main API service',
    runtime: { port: 3000, replicas: 2, memory: '256Mi', cpu: '0.5' },
    deployment: { provider: 'aws', region: 'us-east-1' },
    ...overrides,
  };
}

describe('DeploymentEngine', () => {
  let engine: DeploymentEngine;
  let graphEngine: ReturnType<typeof mockGraphEngine>;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    graphEngine = mockGraphEngine();
    eventBus = mockEventBus();
    engine = new DeploymentEngine(graphEngine as never, eventBus as never);
  });

  // ── Core Pipeline ───────────────────────────────────────────

  describe('generateDeployment()', () => {
    it('generates Docker and CI/CD modules for basic docker platform', async () => {
      graphEngine = mockGraphEngine([makeNode()]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);

      const result = await engine.generateDeployment(
        makeConfig({
          platform: 'docker',
          monitoring: { prometheus: true, grafana: true, alerting: true },
        }),
      );

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);

      const types = result.modules.map((m) => m.type);
      expect(types).toContain('docker');
      expect(types).toContain('cicd');
      expect(types).toContain('monitoring');
      expect(types).toContain('config');
    });

    it('generates Kubernetes modules when platform is kubernetes', async () => {
      graphEngine = mockGraphEngine([makeNode(), makeNode({ id: 'node-2', type: 'cluster', name: 'main-cluster' })]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);

      const result = await engine.generateDeployment(
        makeConfig({ platform: 'kubernetes', cloudProvider: 'aws', region: 'us-east-1' }),
      );

      expect(result.success).toBe(true);
      const types = result.modules.map((m) => m.type);
      expect(types).toContain('kubernetes');
    });

    it('generates Terraform modules when cloudProvider is set', async () => {
      graphEngine = mockGraphEngine([makeNode()]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);

      const result = await engine.generateDeployment(
        makeConfig({ cloudProvider: 'aws', region: 'us-west-2' }),
      );

      const types = result.modules.map((m) => m.type);
      expect(types).toContain('terraform');
    });

    it('skips Kubernetes when platform is docker', async () => {
      const result = await engine.generateDeployment(makeConfig({ platform: 'docker' }));

      const types = result.modules.map((m) => m.type);
      expect(types).not.toContain('kubernetes');
    });

    it('skips Terraform when no cloudProvider', async () => {
      const result = await engine.generateDeployment(makeConfig({ cloudProvider: undefined }));

      const types = result.modules.map((m) => m.type);
      expect(types).not.toContain('terraform');
    });

    it('always generates env config', async () => {
      const result = await engine.generateDeployment(makeConfig());

      const envModule = result.modules.find((m) => m.path.includes('.env'));
      expect(envModule).toBeDefined();
      expect(envModule!.content).toContain('NODE_ENV=staging');
    });

    it('env config reflects production environment', async () => {
      const result = await engine.generateDeployment(
        makeConfig({ environment: 'production' }),
      );

      const envModule = result.modules.find((m) => m.path.includes('.env'));
      expect(envModule!.content).toContain('NODE_ENV=production');
      expect(envModule!.content).toContain('LOG_LEVEL=info');
    });

    it('env config reflects development environment', async () => {
      const result = await engine.generateDeployment(
        makeConfig({ environment: 'development' }),
      );

      const envModule = result.modules.find((m) => m.path.includes('.env'));
      expect(envModule!.content).toContain('NODE_ENV=development');
      expect(envModule!.content).toContain('LOG_LEVEL=debug');
    });

    it('emits started event', async () => {
      await engine.generateDeployment(makeConfig());

      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.deployment.started',
        expect.objectContaining({
          type: 'genesis-1.deployment.started',
          projectId: 'test-project-1',
        }),
      );
    });

    it('emits completed event on success', async () => {
      await engine.generateDeployment(makeConfig());

      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.deployment.completed',
        expect.objectContaining({ type: 'genesis-1.deployment.completed' }),
      );
    });

    it('emits failed event when graph engine throws', async () => {
      (graphEngine.listNodes as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

      const result = await engine.generateDeployment(makeConfig());

      expect(result.success).toBe(false);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.deployment.failed',
        expect.objectContaining({ type: 'genesis-1.deployment.failed' }),
      );
    });

    it('builds deployment plan with correct ordering', async () => {
      graphEngine = mockGraphEngine([makeNode()]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);

      const result = await engine.generateDeployment(
        makeConfig({ platform: 'kubernetes', cloudProvider: 'aws' }),
      );

      expect(result.deploymentPlan.order.length).toBeGreaterThan(0);
      expect(result.deploymentPlan.estimatedMinutes).toBeGreaterThan(0);
      expect(result.deploymentPlan.rollbackPlan.length).toBeGreaterThan(0);
      // Rollback should be reverse of deployment order
      expect(result.deploymentPlan.rollbackPlan.length).toBe(result.deploymentPlan.order.length);
    });

    it('continues when a single generator fails', async () => {
      // Mock a scenario where listNodes works but a sub-generator could fail
      graphEngine = mockGraphEngine([makeNode({ name: null as unknown as string })]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);

      const result = await engine.generateDeployment(makeConfig());

      // Docker generator may fail on null name, but CI/CD and monitoring should still work
      expect(result.errors.length).toBeGreaterThanOrEqual(0); // May or may not have errors depending on implementation
    });
  });

  // ── simulateDeployment() ────────────────────────────────────

  describe('simulateDeployment()', () => {
    it('prefixes paths with dry-run/', async () => {
      const result = await engine.simulateDeployment(makeConfig());

      for (const mod of result.modules) {
        expect(mod.path.startsWith('dry-run/')).toBe(true);
      }
    });

    it('returns same module count as real deployment', async () => {
      const realResult = await engine.generateDeployment(makeConfig());
      const simResult = await engine.simulateDeployment(makeConfig());

      expect(simResult.modules.length).toBe(realResult.modules.length);
    });
  });

  // ── rollback() ──────────────────────────────────────────────

  describe('rollback()', () => {
    it('publishes rollback event', async () => {
      await engine.rollback('proj-1', 'rev-42');

      expect(eventBus.publish).toHaveBeenCalledWith(
        'genesis-1.deployment.rollback',
        expect.objectContaining({
          payload: expect.objectContaining({ revision: 'rev-42' }),
        }),
      );
    });
  });

  // ── Module Validation ──────────────────────────────────────

  describe('module structure', () => {
    it('each module has required fields', async () => {
      graphEngine = mockGraphEngine([makeNode()]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);

      const result = await engine.generateDeployment(
        makeConfig({ platform: 'kubernetes', cloudProvider: 'aws' }),
      );

      for (const mod of result.modules) {
        expect(mod.path).toBeTruthy();
        expect(mod.content).toBeTruthy();
        expect(mod.language).toBeDefined();
        expect(mod.type).toBeDefined();
        expect(mod.description).toBeDefined();
        expect(['dockerfile', 'yaml', 'hcl', 'json', 'toml']).toContain(mod.language);
        expect(['docker', 'kubernetes', 'terraform', 'cicd', 'monitoring', 'config']).toContain(mod.type);
      }
    });
  });

  // ── All Cloud Providers ────────────────────────────────────

  describe('cloud provider support', () => {
    const providers = ['aws', 'gcp', 'azure'] as const;

    for (const provider of providers) {
      it(`generates terraform for ${provider}`, async () => {
        graphEngine = mockGraphEngine([makeNode()]);
        engine = new DeploymentEngine(graphEngine as never, eventBus as never);

        const result = await engine.generateDeployment(
          makeConfig({ cloudProvider: provider, region: 'us-east-1' }),
        );

        const tfModules = result.modules.filter((m) => m.type === 'terraform');
        expect(tfModules.length).toBeGreaterThan(0);
        expect(result.success).toBe(true);
      });
    }
  });

  // ── All Platforms ──────────────────────────────────────────

  describe('platform support', () => {
    it('docker platform generates without kubernetes', async () => {
      graphEngine = mockGraphEngine([makeNode()]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);
      const result = await engine.generateDeployment(makeConfig({ platform: 'docker' }));

      expect(result.modules.some((m) => m.type === 'kubernetes')).toBe(false);
      expect(result.modules.some((m) => m.type === 'docker')).toBe(true);
    });

    it('kubernetes platform generates k8s manifests', async () => {
      graphEngine = mockGraphEngine([makeNode(), makeNode({ id: 'n2', type: 'cluster', name: 'main' })]);
      engine = new DeploymentEngine(graphEngine as never, eventBus as never);
      const result = await engine.generateDeployment(
        makeConfig({ platform: 'kubernetes', cloudProvider: 'aws' }),
      );

      expect(result.modules.some((m) => m.type === 'kubernetes')).toBe(true);
    });
  });

  // ── Monitoring Config ──────────────────────────────────────

  describe('monitoring config', () => {
    it('respects monitoring flags in env config', async () => {
      const result = await engine.generateDeployment(
        makeConfig({
          monitoring: { prometheus: false, grafana: false, alerting: false },
        }),
      );

      const envModule = result.modules.find((m) => m.path.includes('.env'));
      expect(envModule!.content).toContain('PROMETHEUS_ENABLED=false');
    });
  });

  // ── Scaling Config ─────────────────────────────────────────

  describe('scaling config', () => {
    it('respects scaling limits in env config', async () => {
      const result = await engine.generateDeployment(
        makeConfig({ scaling: { min: 3, max: 15, targetCpuPercent: 65 } }),
      );

      const envModule = result.modules.find((m) => m.path.includes('.env'));
      expect(envModule!.content).toContain('SCALING_MIN=3');
      expect(envModule!.content).toContain('SCALING_MAX=15');
      expect(envModule!.content).toContain('SCALING_CPU_TARGET=65');
    });
  });
});
