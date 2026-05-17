import { z } from 'zod';

export const agentGraphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['llm_call', 'tool_call', 'conditional', 'human_input', 'sub_agent', 'code_eval']),
  label: z.string().min(1).max(200),
  config: z.record(z.unknown()).default({}),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const agentGraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  condition: z.record(z.unknown()).optional(),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  graphDefinition: z.object({
    nodes: z.array(agentGraphNodeSchema).min(1),
    edges: z.array(agentGraphEdgeSchema),
  }),
  toolsConfig: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        source: z.enum(['built_in', 'custom']),
        config: z.record(z.unknown()).default({}),
      }),
    )
    .optional()
    .default([]),
  modelConfig: z.object({
    provider: z.enum(['openai', 'anthropic']),
    model: z.string(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().default(4096),
    topP: z.number().min(0).max(1).optional(),
  }),
  prompts: z.object({
    system: z.string(),
    fewShotExamples: z
      .array(
        z.object({
          input: z.string(),
          output: z.string(),
        }),
      )
      .optional(),
  }),
  interruptConfig: z
    .object({
      enabled: z.boolean().default(false),
      points: z.array(z.string()).default([]),
      timeoutMs: z.number().int().positive().optional(),
    })
    .optional()
    .default({ enabled: false, points: [] }),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  graphDefinition: z
    .object({
      nodes: z.array(agentGraphNodeSchema).min(1),
      edges: z.array(agentGraphEdgeSchema),
    })
    .optional(),
  toolsConfig: createAgentSchema.shape.toolsConfig.optional(),
  modelConfig: createAgentSchema.shape.modelConfig.optional(),
  prompts: createAgentSchema.shape.prompts.optional(),
  interruptConfig: createAgentSchema.shape.interruptConfig.optional(),
});

export const executeAgentSchema = z.object({
  input: z.record(z.unknown()).optional().default({}),
});

export const resumeExecutionSchema = z.object({
  input: z.record(z.unknown()),
});
