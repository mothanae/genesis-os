import { z } from 'zod';

export const createRuleSetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  evaluationStrategy: z.enum(['first-match', 'all-match', 'priority']).default('all-match'),
});

export const updateRuleSetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  evaluationStrategy: z.enum(['first-match', 'all-match', 'priority']).optional(),
  enabled: z.boolean().optional(),
});

export const createRuleSchema = z.object({
  ruleSetId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  domain: z.enum(['graph', 'agent', 'simulation', 'project']),
  condition: z.record(z.unknown()),
  action: z.object({
    type: z.enum(['violation', 'block', 'notify', 'webhook', 'transform']),
    severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
    message: z.string().optional(),
    params: z.record(z.unknown()).optional(),
  }),
  priority: z.number().int().min(0).default(100),
  evaluationMode: z.enum(['sync', 'async', 'reactive']).default('sync'),
});

export const updateRuleSchema = z.object({
  ruleSetId: z.string().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  condition: z.record(z.unknown()).optional(),
  action: createRuleSchema.shape.action.optional(),
  priority: z.number().int().min(0).optional(),
  evaluationMode: z.enum(['sync', 'async', 'reactive']).optional(),
  enabled: z.boolean().optional(),
});

export const evaluateRuleSchema = z.object({
  facts: z.record(z.unknown()),
});

export const evaluateBatchSchema = z.object({
  ruleSetId: z.string().optional(),
  ruleIds: z.array(z.string()).optional(),
  facts: z.record(z.unknown()).optional(),
  domain: z.enum(['graph', 'agent', 'simulation', 'project']).optional(),
});

export const resolveViolationSchema = z.object({
  resolvedBy: z.string().optional(),
});
