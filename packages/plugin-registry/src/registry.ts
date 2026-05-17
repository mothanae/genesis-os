import type { GraphNode, RuleDefinition } from '@genesis-1/shared';

// ── Plugin Types ──────────────────────────────────────────────

export type PluginType = 'node_type' | 'rule' | 'generator' | 'tool' | 'simulation_generator' | 'deployment_generator' | 'canvas' | 'theme';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  type: PluginType;
  dependencies?: string[];
  config: Record<string, unknown>;
}

export interface Plugin {
  manifest: PluginManifest;
  hooks: PluginHook[];
  enabled: boolean;
}

export interface PluginHook {
  event: string;
  handler: string;
  priority: number;
}

export interface NodeTypePlugin extends Plugin {
  manifest: PluginManifest & { type: 'node_type' };
  nodeDefinition: {
    type: string;
    label: string;
    icon: string;
    category: string;
    defaultInputs?: Array<{ name: string; type: string }>;
    defaultOutputs?: Array<{ name: string; type: string }>;
    defaultRuntime?: Record<string, unknown>;
    validator?: (node: GraphNode) => { valid: boolean; errors: string[] };
  };
}

export interface RulePlugin extends Plugin {
  manifest: PluginManifest & { type: 'rule' };
  ruleDefinitions: Array<Omit<RuleDefinition, 'id' | 'projectId' | 'version' | 'createdAt' | 'updatedAt'>>;
}

export interface GeneratorPlugin extends Plugin {
  manifest: PluginManifest & { type: 'generator' };
  generator: {
    targetStack: string;
    language: string;
    fileExtension: string;
    generate: (node: GraphNode, config: Record<string, unknown>) => { path: string; content: string }[];
  };
}

// ── Registry ──────────────────────────────────────────────────

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private hooks = new Map<string, Array<{ pluginId: string; handler: string; priority: number }>>();
  private nodeTypePlugins = new Map<string, NodeTypePlugin>();
  private rulePlugins: RulePlugin[] = [];
  private generatorPlugins = new Map<string, GeneratorPlugin>();

  // ── Registration ──────────────────────────────────────────

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error(`Plugin "${plugin.manifest.id}" is already registered`);
    }

    this.plugins.set(plugin.manifest.id, plugin);

    // Index hooks
    for (const hook of plugin.hooks) {
      const handlers = this.hooks.get(hook.event) ?? [];
      handlers.push({ pluginId: plugin.manifest.id, handler: hook.handler, priority: hook.priority });
      handlers.sort((a, b) => b.priority - a.priority);
      this.hooks.set(hook.event, handlers);
    }

    // Index by type
    switch (plugin.manifest.type) {
      case 'node_type':
        this.nodeTypePlugins.set(plugin.manifest.id, plugin as NodeTypePlugin);
        break;
      case 'rule':
        this.rulePlugins.push(plugin as RulePlugin);
        break;
      case 'generator':
        this.generatorPlugins.set(plugin.manifest.id, plugin as GeneratorPlugin);
        break;
    }
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // Remove hooks
    for (const [event, handlers] of this.hooks) {
      this.hooks.set(event, handlers.filter((h) => h.pluginId !== pluginId));
    }

    this.plugins.delete(pluginId);
    this.nodeTypePlugins.delete(pluginId);
    this.rulePlugins = this.rulePlugins.filter((p) => p.manifest.id !== pluginId);
    this.generatorPlugins.delete(pluginId);
  }

  // ── Queries ────────────────────────────────────────────────

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  listPlugins(type?: PluginType): Plugin[] {
    const all = Array.from(this.plugins.values());
    return type ? all.filter((p) => p.manifest.type === type) : all;
  }

  getHooks(event: string): Array<{ pluginId: string; handler: string }> {
    return this.hooks.get(event) ?? [];
  }

  // ── Node Type Extensions ───────────────────────────────────

  getNodeTypes(): Array<{ type: string; label: string; icon: string; category: string }> {
    return Array.from(this.nodeTypePlugins.values()).map((p) => ({
      type: p.nodeDefinition.type,
      label: p.nodeDefinition.label,
      icon: p.nodeDefinition.icon,
      category: p.nodeDefinition.category,
    }));
  }

  getNodeValidator(nodeType: string): ((node: GraphNode) => { valid: boolean; errors: string[] }) | null {
    const plugin = Array.from(this.nodeTypePlugins.values()).find(
      (p) => p.nodeDefinition.type === nodeType,
    );
    return plugin?.nodeDefinition.validator ?? null;
  }

  // ── Rule Extensions ────────────────────────────────────────

  getRuleDefinitions(): Omit<RuleDefinition, 'id' | 'projectId' | 'version' | 'createdAt' | 'updatedAt'>[] {
    return this.rulePlugins.flatMap((p) => p.ruleDefinitions);
  }

  // ── Generator Extensions ───────────────────────────────────

  getGenerator(targetStack: string): GeneratorPlugin | undefined {
    return Array.from(this.generatorPlugins.values()).find(
      (p) => p.generator.targetStack === targetStack,
    );
  }

  listGeneratorStacks(): string[] {
    return Array.from(this.generatorPlugins.values()).map((p) => p.generator.targetStack);
  }

  // ── Stats ──────────────────────────────────────────────────

  getStats(): { totalPlugins: number; byType: Record<string, number>; registeredHooks: number } {
    const byType: Record<string, number> = {};
    for (const p of this.plugins.values()) {
      byType[p.manifest.type] = (byType[p.manifest.type] ?? 0) + 1;
    }
    return {
      totalPlugins: this.plugins.size,
      byType,
      registeredHooks: Array.from(this.hooks.values()).reduce((s, h) => s + h.length, 0),
    };
  }

  // ── Validation ─────────────────────────────────────────────

  validateNewPlugin(plugin: Plugin): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!plugin.manifest.id) errors.push('Missing plugin ID');
    if (!plugin.manifest.name) errors.push('Missing plugin name');
    if (!plugin.manifest.version) errors.push('Missing plugin version');
    if (!plugin.manifest.type) errors.push('Missing plugin type');

    if (this.plugins.has(plugin.manifest.id)) {
      errors.push(`Plugin "${plugin.manifest.id}" already exists`);
    }

    for (const dep of plugin.manifest.dependencies ?? []) {
      if (!this.plugins.has(dep)) {
        errors.push(`Missing dependency: ${dep}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
