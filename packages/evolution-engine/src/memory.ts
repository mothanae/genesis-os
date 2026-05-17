import type { ArchitectureInsight, TemplateMatch, LearnedPattern } from './engine';

export interface MemoryRecord {
  projectId: string;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
  nodeTypes: string[];
  edgeTypes: string[];
  insights: ArchitectureInsight[];
  templateMatches: TemplateMatch[];
  patterns?: string[];
  snapshotId?: string;
}

export interface PersistenceProvider {
  save(record: MemoryRecord): Promise<void>;
  load(projectId: string): Promise<MemoryRecord[]>;
  loadAll(): Promise<MemoryRecord[]>;
  deleteOlderThan(timestamp: number): Promise<number>;
}

export class ArchitectureMemory {
  private records: MemoryRecord[] = [];
  private readonly maxRecords = 1000;
  private persistence: PersistenceProvider | null = null;

  setPersistence(provider: PersistenceProvider): void {
    this.persistence = provider;
  }

  async initialize(): Promise<void> {
    if (this.persistence) {
      this.records = await this.persistence.loadAll();
    }
  }

  async record(entry: Omit<MemoryRecord, 'nodeTypes' | 'edgeTypes'> & { nodeTypes?: string[]; edgeTypes?: string[] }): Promise<void> {
    const record: MemoryRecord = {
      ...entry,
      nodeTypes: entry.nodeTypes ?? [],
      edgeTypes: entry.edgeTypes ?? [],
    };
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
    if (this.persistence) {
      await this.persistence.save(record);
    }
  }

  async recall(projectId: string): Promise<MemoryRecord[]> {
    if (this.persistence) {
      return this.persistence.load(projectId);
    }
    return this.records.filter((r) => r.projectId === projectId);
  }

  async findSimilar(projectId: string, nodeTypes: string[]): Promise<MemoryRecord[]> {
    return this.records
      .filter((r) => r.projectId !== projectId)
      .sort((a, b) => this.typeSimilarity(b, nodeTypes) - this.typeSimilarity(a, nodeTypes))
      .slice(0, 10);
  }

  private typeSimilarity(record: MemoryRecord, types: string[]): number {
    const recordTypes = new Set(record.insights.flatMap((i) => i.type));
    const overlap = types.filter((t) => recordTypes.has(t as ArchitectureInsight['type'])).length;
    return overlap / Math.max(types.length, 1);
  }

  async learnPatterns(): Promise<LearnedPattern[]> {
    const patterns: LearnedPattern[] = [];

    if (this.records.length > 5) {
      const monolithRecords = this.records.filter((r) =>
        r.insights.some((i) => i.title?.includes('Monolith')),
      );
      if (monolithRecords.length > 0) {
        patterns.push({
          id: 'pattern-monolith-warning',
          name: 'Monolith Early Warning',
          description: `Detected ${monolithRecords.length} projects with monolith architecture.`,
          frequency: monolithRecords.length / this.records.length,
          lastSeenAt: Math.max(...monolithRecords.map((r) => r.timestamp)),
          nodeTypes: ['service', 'function', 'database'],
          edgeTypes: ['depends_on'],
          typicalInsights: ['Monolith Detected', 'No API Gateway', 'High Fan-In'],
        });
      }

      const noCacheRecords = this.records.filter((r) =>
        r.insights.some((i) => i.title?.includes('Cach')),
      );
      if (noCacheRecords.length > 0) {
        patterns.push({
          id: 'pattern-missing-cache',
          name: 'Missing Cache Pattern',
          description: 'Common: databases without caching layers.',
          frequency: noCacheRecords.length / this.records.length,
          lastSeenAt: Math.max(...noCacheRecords.map((r) => r.timestamp)),
          nodeTypes: ['database'],
          edgeTypes: ['writes_to', 'reads_from'],
          typicalInsights: ['No Caching Layer'],
        });
      }
    }

    return patterns;
  }

  async cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    this.records = this.records.filter((r) => r.timestamp > cutoff);
    if (this.persistence) {
      await this.persistence.deleteOlderThan(cutoff);
    }
  }

  getStats(): { totalRecords: number; uniqueProjects: number; oldestTimestamp: number; newestTimestamp: number } {
    const projects = new Set(this.records.map((r) => r.projectId));
    return {
      totalRecords: this.records.length,
      uniqueProjects: projects.size,
      oldestTimestamp: this.records.length > 0 ? Math.min(...this.records.map((r) => r.timestamp)) : 0,
      newestTimestamp: this.records.length > 0 ? Math.max(...this.records.map((r) => r.timestamp)) : 0,
    };
  }
}
