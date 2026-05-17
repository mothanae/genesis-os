import type { DatabaseClient } from '@genesis-1/database';
import { memoryRecords, learnedPatterns, evolutionActions } from '@genesis-1/database';
import { eq, lt } from 'drizzle-orm';
import type { PersistenceProvider, MemoryRecord } from './memory';
import type { LearnedPattern } from './engine';

/**
 * Drizzle-backed persistence provider for ArchitectureMemory.
 * Stores evolution records, learned patterns, and actions in PostgreSQL.
 */
export class DrizzlePersistenceProvider implements PersistenceProvider {
  constructor(private readonly db: DatabaseClient) {}

  async save(record: MemoryRecord): Promise<void> {
    await this.db
      .insert(memoryRecords)
      .values({
        projectId: record.projectId,
        snapshotId: record.snapshotId ?? null,
        timestamp: new Date(record.timestamp),
        nodeCount: record.nodeCount,
        edgeCount: record.edgeCount,
        nodeTypes: record.nodeTypes,
        edgeTypes: record.edgeTypes,
        insights: record.insights as unknown[],
        templateMatches: record.templateMatches as unknown[],
        patterns: record.patterns ?? null,
      })
      .onConflictDoNothing();
  }

  async load(projectId: string): Promise<MemoryRecord[]> {
    const rows = await this.db
      .select()
      .from(memoryRecords)
      .where(eq(memoryRecords.projectId, projectId))
      .orderBy(memoryRecords.timestamp);

    return rows.map(rowToMemoryRecord);
  }

  async loadAll(): Promise<MemoryRecord[]> {
    const rows = await this.db
      .select()
      .from(memoryRecords)
      .orderBy(memoryRecords.timestamp)
      .limit(1000);

    return rows.map(rowToMemoryRecord);
  }

  async deleteOlderThan(timestamp: number): Promise<number> {
    const result = await this.db
      .delete(memoryRecords)
      .where(lt(memoryRecords.timestamp, new Date(timestamp)));

    return typeof result === 'number' ? result : (result as { rowCount?: number })?.rowCount ?? 0;
  }

  // ── Learned Patterns ──────────────────────────────────────────────

  async savePatterns(patterns: LearnedPattern[]): Promise<void> {
    for (const pattern of patterns) {
      await this.db
        .insert(learnedPatterns)
        .values({
          name: pattern.name,
          description: pattern.description,
          frequency: pattern.frequency,
          lastSeenAt: new Date(pattern.lastSeenAt),
          nodeTypes: pattern.nodeTypes,
          edgeTypes: pattern.edgeTypes,
          typicalInsights: pattern.typicalInsights,
          occurrenceCount: Math.round(pattern.frequency * 100),
        })
        .onConflictDoNothing();
    }
  }

  async loadPatterns(): Promise<LearnedPattern[]> {
    const rows = await this.db
      .select()
      .from(learnedPatterns)
      .orderBy(learnedPatterns.frequency);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      frequency: r.frequency,
      lastSeenAt: r.lastSeenAt.getTime(),
      nodeTypes: r.nodeTypes,
      edgeTypes: r.edgeTypes,
      typicalInsights: r.typicalInsights,
    }));
  }

  // ── Evolution Actions ──────────────────────────────────────────────

  async recordAction(action: {
    projectId: string;
    actionType: string;
    description?: string;
    nodeId?: string;
    edgeId?: string;
    applied?: boolean;
    success?: boolean;
    error?: string;
  }): Promise<void> {
    await this.db.insert(evolutionActions).values({
      projectId: action.projectId,
      actionType: action.actionType,
      description: action.description ?? null,
      nodeId: action.nodeId ?? null,
      edgeId: action.edgeId ?? null,
      applied: action.applied ?? false,
      success: action.success ?? false,
      error: action.error ?? null,
    });
  }

  async getActions(projectId: string): Promise<unknown[]> {
    return this.db
      .select()
      .from(evolutionActions)
      .where(eq(evolutionActions.projectId, projectId))
      .orderBy(evolutionActions.createdAt);
  }
}

// ── Private Helpers ──────────────────────────────────────────────────

function rowToMemoryRecord(row: Record<string, unknown>): MemoryRecord {
  return {
    projectId: row.project_id as string,
    snapshotId: row.snapshot_id as string | undefined,
    timestamp: (row.timestamp as Date).getTime(),
    nodeCount: row.node_count as number,
    edgeCount: row.edge_count as number,
    nodeTypes: (row.node_types as string[]) ?? [],
    edgeTypes: (row.edge_types as string[]) ?? [],
    insights: (row.insights as MemoryRecord['insights']) ?? [],
    templateMatches: (row.template_matches as MemoryRecord['templateMatches']) ?? [],
    patterns: row.patterns as string[] | undefined,
  };
}
