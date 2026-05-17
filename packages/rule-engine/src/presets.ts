import type { RuleDefinition } from '@genesis-1/shared';

/**
 * Pre-built architecture validation rules.
 * These are the default rule sets shipped with Genesis-1.
 */

export interface RulePreset {
  id: string;
  name: string;
  description: string;
  domain: RuleDefinition['domain'];
  rules: Array<Omit<RuleDefinition, 'id' | 'projectId' | 'version' | 'createdAt' | 'updatedAt'>>;
}

// ── Graph Architecture Rules ──────────────────────────────────

export const graphArchitecturePreset: RulePreset = {
  id: 'preset-graph-architecture',
  name: 'Graph Architecture Validator',
  description: 'Validates graph topology, connectivity, and architectural patterns',
  domain: 'graph',
  rules: [
    {
      name: 'no_cyclic_dependencies',
      description: 'Prevent circular dependencies between components',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        not: {
          any: {
            var: 'cycles',
          },
        },
      },
      action: {
        type: 'violation',
        severity: 'error',
        message: 'Dependency cycle detected: {{targetId}}. Remove one edge to break the cycle.',
        params: { blockOperation: true },
      },
      enabled: true,
      priority: 1,
      evaluationMode: 'reactive',
    },
    {
      name: 'every_service_has_owner',
      description: 'Every service must belong to a bounded context or environment',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { eq: [{ var: 'event.payload.type' }, 'service'] },
          { eq: [{ var: 'event.payload.parentId' }, null] },
        ],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'Service "{{event.payload.name}}" has no parent context. Place it in an environment or bounded context.',
        params: {},
      },
      enabled: true,
      priority: 10,
      evaluationMode: 'reactive',
    },
    {
      name: 'max_dependency_depth',
      description: 'Warn when dependency chain exceeds 5 levels',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        gt: [{ var: 'event.payload.depth' }, 5],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'Deep dependency chain (depth: {{event.payload.depth}}). Consider using events or a facade to flatten.',
        params: {},
      },
      enabled: true,
      priority: 20,
      evaluationMode: 'reactive',
    },
    {
      name: 'database_must_have_encryption',
      description: 'Database nodes should have encryption configured',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { eq: [{ var: 'event.payload.type' }, 'database'] },
          { not: { exists: { var: 'event.payload.runtime.encryption' } } },
        ],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'Database "{{event.payload.name}}" has no encryption configured. Enable encryption at rest.',
        params: { blockOperation: false },
      },
      enabled: true,
      priority: 15,
      evaluationMode: 'reactive',
    },
    {
      name: 'api_gateway_needs_rate_limiting',
      description: 'API Gateways should configure rate limiting',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { eq: [{ var: 'event.payload.type' }, 'api_gateway'] },
          { not: { exists: { var: 'event.payload.runtime.rateLimit' } } },
        ],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'API Gateway "{{event.payload.name}}" has no rate limiting configured.',
        params: {},
      },
      enabled: true,
      priority: 15,
      evaluationMode: 'reactive',
    },
    {
      name: 'avoid_single_point_of_failure',
      description: 'Critical services should not have single points of failure',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { in: [{ var: 'event.payload.type' }, ['service', 'database', 'api_gateway']] },
          { lt: [{ var: 'event.payload.runtime.replicas' }, 2] },
        ],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: '"{{event.payload.name}}" has fewer than 2 replicas. Consider scaling for high availability.',
        params: {},
      },
      enabled: true,
      priority: 20,
      evaluationMode: 'reactive',
    },
  ],
};

// ── Security Rules ────────────────────────────────────────────

export const securityPreset: RulePreset = {
  id: 'preset-security',
  name: 'Security Validator',
  description: 'Checks for common security issues in the architecture',
  domain: 'graph',
  rules: [
    {
      name: 'public_endpoints_need_auth',
      description: 'Public-facing services must have authentication',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { in: [{ var: 'event.payload.type' }, ['api_gateway', 'rest_endpoint', 'graphql_schema']] },
          { not: { exists: { var: 'event.payload.runtime.auth' } } },
        ],
      },
      action: {
        type: 'violation',
        severity: 'error',
        message: '"{{event.payload.name}}" is public-facing but has no auth configured.',
        params: { blockOperation: true },
      },
      enabled: true,
      priority: 1,
      evaluationMode: 'reactive',
    },
    {
      name: 'no_public_database',
      description: 'Databases must never be directly exposed to the internet',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { eq: [{ var: 'event.payload.type' }, 'database'] },
          { eq: [{ var: 'event.payload.runtime.publicAccess' }, true] },
        ],
      },
      action: {
        type: 'violation',
        severity: 'critical',
        message: 'Database "{{event.payload.name}}" is publicly accessible. Remove public access immediately.',
        params: { blockOperation: true },
      },
      enabled: true,
      priority: 1,
      evaluationMode: 'reactive',
    },
    {
      name: 'secrets_in_env_vars',
      description: 'Check for secrets directly in environment variables',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        any: {
          path: { var: 'event.payload.runtime.env' },
          as: 'entry',
          condition: {
            and: [
              {
                any: {
                  path: { var: 'entry.key' },
                  condition: {
                    contains: { var: 'entry.key' },
                  },
                },
              },
            ],
          },
        },
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'Potential secrets in environment variables. Use a secrets manager.',
        params: {},
      },
      enabled: false, // Disabled by default — noisy
      priority: 30,
      evaluationMode: 'async',
    },
  ],
};

// ── Scalability Rules ─────────────────────────────────────────

export const scalabilityPreset: RulePreset = {
  id: 'preset-scalability',
  name: 'Scalability Validator',
  description: 'Checks for scalability issues in the architecture',
  domain: 'graph',
  rules: [
    {
      name: 'caching_strategy_present',
      description: 'Services with databases should have a caching layer',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { eq: [{ var: 'event.payload.type' }, 'service'] },
          { eq: [{ var: 'event.payload.hasDatabaseConnection' }, true] },
          { not: { eq: [{ var: 'event.payload.hasCache' }, true] } },
        ],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'Service "{{event.payload.name}}" connects to a database but has no cache. Consider adding a cache layer.',
        params: {},
      },
      enabled: true,
      priority: 25,
      evaluationMode: 'reactive',
    },
    {
      name: 'queue_for_async_operations',
      description: 'Long-running operations should use a queue',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { eq: [{ var: 'event.payload.type' }, 'service'] },
          { gt: [{ var: 'event.payload.runtime.timeout' }, 10000] },
          { not: { eq: [{ var: 'event.payload.hasQueue' }, true] } },
        ],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'Service "{{event.payload.name}}" has long timeouts. Offload to a queue for async processing.',
        params: {},
      },
      enabled: true,
      priority: 25,
      evaluationMode: 'reactive',
    },
    {
      name: 'autoscaling_configured',
      description: 'Services should have autoscaling enabled',
      domain: 'graph',
      ruleSetId: null,
      condition: {
        all: [
          { in: [{ var: 'event.payload.type' }, ['service', 'container']] },
          { not: { exists: { var: 'event.payload.runtime.scaling' } } },
        ],
      },
      action: {
        type: 'violation',
        severity: 'warning',
        message: 'Service "{{event.payload.name}}" has no autoscaling configured.',
        params: {},
      },
      enabled: true,
      priority: 30,
      evaluationMode: 'reactive',
    },
  ],
};

// ── All Presets ───────────────────────────────────────────────

export const ALL_PRESETS: RulePreset[] = [
  graphArchitecturePreset,
  securityPreset,
  scalabilityPreset,
];
