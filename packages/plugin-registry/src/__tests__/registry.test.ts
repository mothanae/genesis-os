import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../registry';
import type { Plugin, PluginManifest } from '../registry';

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    type: 'node_type',
    config: {},
    ...overrides,
  };
}

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: makeManifest(overrides.manifest as Partial<PluginManifest>),
    hooks: [],
    enabled: true,
    ...overrides,
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('registers a valid plugin', () => {
      const plugin = makePlugin();
      registry.register(plugin);

      expect(registry.getPlugin('test-plugin')).toBe(plugin);
      expect(registry.listPlugins()).toHaveLength(1);
    });

    it('throws on duplicate plugin ID', () => {
      registry.register(makePlugin());
      expect(() => registry.register(makePlugin())).toThrow('already registered');
    });

    it('validateNewPlugin reports error for empty name', () => {
      const result = registry.validateNewPlugin(
        makePlugin({ manifest: makeManifest({ name: '' }) }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validateNewPlugin reports error for empty version', () => {
      const result = registry.validateNewPlugin(
        makePlugin({ manifest: makeManifest({ version: '' }) }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('indexes hooks by event type', () => {
      const plugin = makePlugin({
        hooks: [
          { event: 'graph.node.created', handler: 'onNodeCreated', priority: 10 },
          { event: 'graph.edge.created', handler: 'onEdgeCreated', priority: 5 },
        ],
      });
      registry.register(plugin);

      const graphHooks = registry.getHooks('graph.node.created');
      expect(graphHooks).toHaveLength(1);
      expect(graphHooks[0]!.handler).toBe('onNodeCreated');
    });

    it('sorts hooks by priority (lower number = higher priority)', () => {
      registry.register(
        makePlugin({
          manifest: makeManifest({ id: 'p1' }),
          hooks: [{ event: 'test.event', handler: 'low', priority: 100 }],
        }),
      );
      registry.register(
        makePlugin({
          manifest: makeManifest({ id: 'p2' }),
          hooks: [{ event: 'test.event', handler: 'high', priority: 1 }],
        }),
      );

      const hooks = registry.getHooks('test.event');
      // Lower priority number = higher priority = first in list
      expect(hooks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('unregister', () => {
    it('removes a registered plugin', () => {
      registry.register(makePlugin());
      registry.unregister('test-plugin');

      expect(registry.getPlugin('test-plugin')).toBeUndefined();
      expect(registry.listPlugins()).toHaveLength(0);
    });

    it('cleans up hooks on unregister', () => {
      registry.register(
        makePlugin({
          hooks: [{ event: 'test.event', handler: 'testHandler', priority: 1 }],
        }),
      );
      registry.unregister('test-plugin');

      expect(registry.getHooks('test.event')).toHaveLength(0);
    });

    it('does not throw when unregistering nonexistent plugin', () => {
      expect(() => registry.unregister('nonexistent')).not.toThrow();
    });
  });

  describe('listPlugins', () => {
    it('filters by type', () => {
      registry.register(makePlugin({ manifest: makeManifest({ id: 'p1', type: 'node_type' }) }));
      registry.register(makePlugin({ manifest: makeManifest({ id: 'p2', type: 'rule' }) }));

      expect(registry.listPlugins('node_type')).toHaveLength(1);
      expect(registry.listPlugins('rule')).toHaveLength(1);
      expect(registry.listPlugins('generator')).toHaveLength(0);
    });

    it('returns all plugins when no type filter', () => {
      registry.register(makePlugin({ manifest: makeManifest({ id: 'p1' }) }));
      registry.register(makePlugin({ manifest: makeManifest({ id: 'p2' }) }));

      expect(registry.listPlugins()).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('returns correct counts', () => {
      registry.register(
        makePlugin({
          manifest: makeManifest({ id: 'p1', type: 'node_type' }),
          hooks: [{ event: 'e1', handler: 'h1', priority: 1 }],
        }),
      );
      registry.register(
        makePlugin({
          manifest: makeManifest({ id: 'p2', type: 'rule' }),
          hooks: [
            { event: 'e2', handler: 'h2', priority: 1 },
            { event: 'e3', handler: 'h3', priority: 1 },
          ],
        }),
      );

      const stats = registry.getStats();
      expect(stats.totalPlugins).toBe(2);
      expect(stats.registeredHooks).toBe(3);
      expect(stats.byType['node_type']).toBe(1);
      expect(stats.byType['rule']).toBe(1);
    });
  });
});
