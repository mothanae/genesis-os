import { describe, it, expect } from 'vitest';

// We test the schemas directly since they're pure Zod — no mocking needed
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schema';
import { createAgentSchema, updateAgentSchema, executeAgentSchema } from '../schemas/agent.schema';
import { createRuleSetSchema, createRuleSchema, evaluateRuleSchema } from '../schemas/rule.schema';
import { createSimulationSchema } from '../schemas/simulation.schema';

describe('Project Schemas', () => {
  it('validates a valid project creation', () => {
    const result = createProjectSchema.safeParse({
      name: 'My Project',
      description: 'A test project',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Project');
    }
  });

  it('rejects empty name', () => {
    const result = createProjectSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 200 chars', () => {
    const result = createProjectSchema.safeParse({ name: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('validates partial update with only name', () => {
    const result = updateProjectSchema.safeParse({ name: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('validates empty update (all fields optional)', () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('Agent Schemas', () => {
  const validAgent = {
    name: 'Test Agent',
    description: 'A test agent',
    graphDefinition: {
      nodes: [{ id: 'n1', type: 'llm_call' as const, label: 'Step 1', position: { x: 0, y: 0 } }],
      edges: [],
    },
    modelConfig: {
      provider: 'openai' as const,
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 2048,
    },
    prompts: {
      system: 'You are a helpful assistant.',
    },
  };

  it('validates a complete agent', () => {
    const result = createAgentSchema.safeParse(validAgent);
    expect(result.success).toBe(true);
  });

  it('rejects empty graph definition', () => {
    const result = createAgentSchema.safeParse({
      ...validAgent,
      graphDefinition: { nodes: [], edges: [] },
    });
    expect(result.success).toBe(false);
  });

  it('defaults toolsConfig to empty array', () => {
    const result = createAgentSchema.safeParse(validAgent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toolsConfig).toEqual([]);
    }
  });

  it('defaults interruptConfig correctly', () => {
    const result = createAgentSchema.safeParse(validAgent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interruptConfig).toEqual({ enabled: false, points: [] });
    }
  });

  it('rejects temperature out of range', () => {
    const result = createAgentSchema.safeParse({
      ...validAgent,
      modelConfig: { ...validAgent.modelConfig, temperature: 3 },
    });
    expect(result.success).toBe(false);
  });

  it('validates partial agent update', () => {
    const result = updateAgentSchema.safeParse({ name: 'Updated Agent' });
    expect(result.success).toBe(true);
  });

  it('validates execute agent with empty input', () => {
    const result = executeAgentSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input).toEqual({});
    }
  });

  it('validates execute agent with provided input', () => {
    const result = executeAgentSchema.safeParse({ input: { userId: '123', action: 'test' } });
    expect(result.success).toBe(true);
  });
});

describe('Rule Schemas', () => {
  it('validates rule set creation', () => {
    const result = createRuleSetSchema.safeParse({
      name: 'Architecture Rules',
      description: 'Validates architecture patterns',
      evaluationStrategy: 'all-match',
    });
    expect(result.success).toBe(true);
  });

  it('defaults evaluationStrategy to all-match', () => {
    const result = createRuleSetSchema.safeParse({ name: 'Rules' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evaluationStrategy).toBe('all-match');
    }
  });

  it('validates rule creation with all fields', () => {
    const result = createRuleSchema.safeParse({
      name: 'No Cycles',
      domain: 'graph',
      condition: { '>': [{ var: 'depth' }, 5] },
      action: { type: 'violation', severity: 'error', message: 'Too deep' },
      priority: 50,
      evaluationMode: 'sync',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid domain', () => {
    const result = createRuleSchema.safeParse({
      name: 'Rule',
      domain: 'invalid',
      condition: {},
      action: { type: 'violation' },
    });
    expect(result.success).toBe(false);
  });

  it('validates evaluate rule schema', () => {
    const result = evaluateRuleSchema.safeParse({
      facts: { depth: 8, serviceCount: 3 },
    });
    expect(result.success).toBe(true);
  });
});

describe('Simulation Schemas', () => {
  it('validates simulation creation with defaults', () => {
    const result = createSimulationSchema.safeParse({
      name: 'Load Test',
      termination: { maxSteps: 1000, maxTime: 600 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initialState).toEqual({});
      expect(result.data.eventGenerators).toEqual([]);
    }
  });

  it('validates simulation with generators', () => {
    const result = createSimulationSchema.safeParse({
      name: 'Full Test',
      initialState: { users: 100 },
      eventGenerators: [
        { type: 'traffic', config: { rps: 50 }, enabled: true },
        { type: 'failure', config: { probability: 0.1 }, enabled: false },
      ],
      termination: { maxSteps: 5000, maxTime: 3600 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventGenerators).toHaveLength(2);
    }
  });

  it('rejects missing termination config', () => {
    const result = createSimulationSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxSteps', () => {
    const result = createSimulationSchema.safeParse({
      name: 'Test',
      termination: { maxSteps: -1, maxTime: 100 },
    });
    expect(result.success).toBe(false);
  });
});
