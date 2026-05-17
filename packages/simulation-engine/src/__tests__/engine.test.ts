import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@genesis-1/database', () => ({
  simulationRuns: {} as any,
  simulationEvents: {} as any,
  simulationDefinitions: {} as any,
}));

vi.mock('@genesis-1/shared', () => ({
  EventType: {
    SimulationRunStarted: 'simulation.run.started',
    SimulationRunCompleted: 'simulation.run.completed',
    SimulationRunFailed: 'simulation.run.failed',
    SimulationRunProgress: 'simulation.run.progress',
  },
}));

import { SimulationEngine } from '../engine';
import type { SimulationConfig } from '../engine';

function createMockDb() {
  const runRow = {
    id: 'run-1',
    definitionId: 'sim-1',
    projectId: 'proj-1',
    triggeredBy: 'user-1',
    status: 'running',
    totalSteps: 0,
    clockEnd: 0,
    metrics: null,
    startedAt: new Date(),
    completedAt: null,
    error: null,
    createdAt: new Date(),
  };

  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnValue([runRow]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return mockDb;
}

function createMockEventBus() {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
  };
}

function createMinimalConfig(): SimulationConfig {
  return {
    projectId: 'proj-1',
    simulationId: 'sim-1',
    initialState: {
      services: {},
      databases: {},
      queues: {},
      caches: {},
    },
    duration: 100,
    tickInterval: 50,
    generators: [],
    failureInjection: {
      enabled: false,
      types: [],
      frequency: 0,
      durationMs: 0,
    },
  };
}

describe('SimulationEngine', () => {
  describe('runSimulation', () => {
    it('should complete a simulation with no generators', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();
      const engine = new SimulationEngine({ db, eventBus });

      const config = createMinimalConfig();
      const run = await engine.runSimulation('sim-1', 'proj-1', 'user-1', config);

      expect(run.status).toBe('completed');
    });

    it('should publish started and completed events', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();
      const engine = new SimulationEngine({ db, eventBus });

      const config = createMinimalConfig();
      await engine.runSimulation('sim-1', 'proj-1', 'user-1', config);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          payload: expect.objectContaining({ runId: 'run-1' }),
        }),
      );
    });
  });

  describe('startRun', () => {
    it('should look up definition and start a run', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();
      let selectCallCount = 0;

      // First select call: look up definition. Second: listNodes in runSimulation.
      db.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(
                selectCallCount === 1
                  ? [{
                      id: 'sim-1',
                      projectId: 'proj-1',
                      name: 'Test Simulation',
                      initialState: { services: {} },
                      eventGenerators: [],
                      rulesConfig: {},
                      termination: { maxDuration: 100, tickInterval: 50 },
                      version: 1,
                    }]
                  : [],
              ),
              orderBy: vi.fn().mockReturnValue([]),
            }),
          }),
        };
      });

      const engine = new SimulationEngine({ db, eventBus });

      const run = await engine.startRun('sim-1', 'proj-1', 'user-1');

      expect(run).toBeTruthy();
      expect(run.status).toBe('completed');
    });

    it('should throw if definition is not found', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();

      db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([]),
          }),
        }),
      });

      const engine = new SimulationEngine({ db, eventBus });

      await expect(
        engine.startRun('nonexistent', 'proj-1', 'user-1'),
      ).rejects.toThrow('Simulation definition not found');
    });
  });

  describe('listRuns', () => {
    it('should return runs for a simulation', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();
      const engine = new SimulationEngine({ db, eventBus });

      db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue([]),
          }),
        }),
      });

      const runs = await engine.listRuns('sim-1');
      expect(Array.isArray(runs)).toBe(true);
    });
  });

  describe('getRun', () => {
    it('should return a specific run', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();
      const engine = new SimulationEngine({ db, eventBus });

      const runRow = {
        id: 'run-1',
        definitionId: 'sim-1',
        projectId: 'proj-1',
        status: 'completed',
        totalSteps: 10,
        clockEnd: 1000,
        metrics: null,
        startedAt: new Date(),
        completedAt: new Date(),
        error: null,
        createdAt: new Date(),
        triggeredBy: 'user-1',
      };

      db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([runRow]),
          }),
        }),
      });

      const run = await engine.getRun('run-1');
      expect(run).toBeTruthy();
      expect(run?.id).toBe('run-1');
    });

    it('should return null for non-existent run', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();
      const engine = new SimulationEngine({ db, eventBus });

      db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([]),
          }),
        }),
      });

      const run = await engine.getRun('nonexistent');
      expect(run).toBeNull();
    });
  });

  describe('getRunEvents', () => {
    it('should return events for a run', async () => {
      const db = createMockDb();
      const eventBus = createMockEventBus();
      const engine = new SimulationEngine({ db, eventBus });

      const eventRows = [
        { id: 'evt-1', runId: 'run-1', simTime: 1, eventType: 'http.request.completed', source: 'svc-1', payload: {} },
        { id: 'evt-2', runId: 'run-1', simTime: 2, eventType: 'database.read', source: 'db-1', payload: {} },
      ];

      db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue(eventRows),
          }),
        }),
      });

      const events = await engine.getRunEvents('run-1');
      expect(Array.isArray(events)).toBe(true);
      expect(events).toHaveLength(2);
    });
  });
});
