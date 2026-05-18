import { z } from 'zod';

export const createSimulationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  initialState: z.record(z.unknown()).default({}),
  eventGenerators: z
    .array(
      z.object({
        type: z.enum(['http_traffic', 'db_queries', 'events', 'auth', 'background_jobs', 'websocket']),
        config: z.record(z.unknown()).default({}),
        enabled: z.boolean().default(true),
      }),
    )
    .default([]),
  rulesConfig: z.object({
    ruleSetIds: z.array(z.string()).default([]),
    evaluateOnEveryEvent: z.boolean().default(true),
  }).default({ ruleSetIds: [], evaluateOnEveryEvent: true }),
  termination: z.object({
    maxSteps: z.number().int().positive().default(10000),
    maxTime: z.number().positive().default(3600),
    stabilityThreshold: z.number().min(0).default(0.01),
  }),
});

export const updateSimulationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  initialState: z.record(z.unknown()).optional(),
  eventGenerators: createSimulationSchema.shape.eventGenerators.optional(),
  rulesConfig: createSimulationSchema.shape.rulesConfig.optional(),
  termination: createSimulationSchema.shape.termination.optional(),
});
