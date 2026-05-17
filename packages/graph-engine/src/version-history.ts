import type { DatabaseClient } from '@genesis-1/database';
import type { GraphNode, GraphEdge, GraphDiff, GraphSnapshot } from '@genesis-1/shared';
import { nodes, edges, snapshots } from '@genesis-1/database';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface VersionEntry {
  id: string;
  projectId: string;
  version: number;
  timestamp: string;
  author?: string;
  message: string;
  nodeCount: number;
  edgeCount: number;
  snapshotId: string;
  parentVersionId?: string;
  changes: {
    addedNodes: number;
    removedNodes: number;
    modifiedNodes: number;
    addedEdges: number;
    removedEdges: number;
    modifiedEdges: number;
  };
}

export interface VersionCompareResult {
  fromVersion: number;
  toVersion: number;
  diff: GraphDiff;
  summary: {
    totalChanges: number;
    structuralImpact: 'low' | 'medium' | 'high';
    breakingChanges: string[];
  };
}

export class VersionHistory {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Create a version entry from the current graph state.
   */
  async snapshot(
    projectId: string,
    message: string,
    author?: string,
  ): Promise<VersionEntry> {
    // Create a graph snapshot for the version
    const allNodes = await this.db.select().from(nodes).where(eq(nodes.projectId, projectId));
    const allEdges = await this.db.select().from(edges).where(eq(edges.projectId, projectId));

    const snapshotResult = await this.db
      .insert(snapshots)
      .values({
        projectId,
        label: `version-${Date.now()}`,
        nodeCount: allNodes.length,
        edgeCount: allEdges.length,
        graphData: { nodes: allNodes, edges: allEdges } as never,
      })
      .returning();

    const snapshotId = snapshotResult[0]!.id;

    // Get the previous version
    const prevVersion = await this.getLatestVersion(projectId);

    // Compute changes
    let changes = { addedNodes: allNodes.length, removedNodes: 0, modifiedNodes: 0, addedEdges: allEdges.length, removedEdges: 0, modifiedEdges: 0 };

    if (prevVersion && prevVersion.snapshotId) {
      const prevSnapshot = await this.db
        .select()
        .from(snapshots)
        .where(eq(snapshots.id, prevVersion.snapshotId))
        .limit(1);

      if (prevSnapshot[0]) {
        const prevData = prevSnapshot[0].graphData as { nodes: GraphNode[]; edges: GraphEdge[] };
        const prevNodeIds = new Set(prevData.nodes.map((n) => n.id));
        const prevEdgeIds = new Set(prevData.edges.map((e) => e.id));
        const currNodeIds = new Set(allNodes.map((n) => n.id));
        const currEdgeIds = new Set(allEdges.map((e) => e.id));

        changes = {
          addedNodes: allNodes.filter((n) => !prevNodeIds.has(n.id)).length,
          removedNodes: prevData.nodes.filter((n) => !currNodeIds.has(n.id)).length,
          modifiedNodes: allNodes.filter((n) => prevNodeIds.has(n.id) && n.version > (prevData.nodes.find((pn) => pn.id === n.id)?.version ?? 1)).length,
          addedEdges: allEdges.filter((e) => !prevEdgeIds.has(e.id)).length,
          removedEdges: prevData.edges.filter((e) => !currEdgeIds.has(e.id)).length,
          modifiedEdges: 0,
        };
      }
    }

    const version = (prevVersion?.version ?? 0) + 1;

    return {
      id: `v_${projectId}_${version}`,
      projectId,
      version,
      timestamp: new Date().toISOString(),
      author,
      message,
      nodeCount: allNodes.length,
      edgeCount: allEdges.length,
      snapshotId,
      parentVersionId: prevVersion?.id,
      changes,
    };
  }

  /**
   * Get the latest version for a project.
   */
  async getLatestVersion(projectId: string): Promise<VersionEntry | null> {
    const result = await this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, projectId))
      .orderBy(desc(snapshots.createdAt))
      .limit(1);

    if (!result[0]) return null;

    return {
      id: `v_${projectId}_latest`,
      projectId,
      version: 0,
      timestamp: result[0].createdAt.toISOString(),
      message: 'Latest snapshot',
      nodeCount: result[0].nodeCount,
      edgeCount: result[0].edgeCount,
      snapshotId: result[0].id,
      changes: { addedNodes: 0, removedNodes: 0, modifiedNodes: 0, addedEdges: 0, removedEdges: 0, modifiedEdges: 0 },
    };
  }

  /**
   * List version history for a project.
   */
  async list(projectId: string, limit = 20): Promise<VersionEntry[]> {
    const result = await this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, projectId))
      .orderBy(desc(snapshots.createdAt))
      .limit(limit);

    return result.map((s, i) => ({
      id: `v_${projectId}_${result.length - i}`,
      projectId,
      version: result.length - i,
      timestamp: s.createdAt.toISOString(),
      message: s.label,
      nodeCount: s.nodeCount,
      edgeCount: s.edgeCount,
      snapshotId: s.id,
      changes: { addedNodes: 0, removedNodes: 0, modifiedNodes: 0, addedEdges: 0, removedEdges: 0, modifiedEdges: 0 },
    }));
  }

  /**
   * Compare two versions and return the full diff.
   */
  async compare(
    projectId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<VersionCompareResult> {
    const history = await this.list(projectId);
    const fromEntry = history.find((v) => v.version === fromVersion);
    const toEntry = history.find((v) => v.version === toVersion);

    if (!fromEntry || !toEntry) throw new Error('Version not found');

    const fromSnapshot = await this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.id, fromEntry.snapshotId))
      .limit(1);

    const toSnapshot = await this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.id, toEntry.snapshotId))
      .limit(1);

    if (!fromSnapshot[0] || !toSnapshot[0]) throw new Error('Snapshot data missing');

    const fromData = fromSnapshot[0].graphData as { nodes: GraphNode[]; edges: GraphEdge[] };
    const toData = toSnapshot[0].graphData as { nodes: GraphNode[]; edges: GraphEdge[] };
    const fromNodeIds = new Set(fromData.nodes.map((n) => n.id));
    const toNodeIds = new Set(toData.nodes.map((n) => n.id));
    const fromEdgeIds = new Set(fromData.edges.map((e) => e.id));
    const toEdgeIds = new Set(toData.edges.map((e) => e.id));

    const diff: GraphDiff = {
      addedNodes: toData.nodes.filter((n) => !fromNodeIds.has(n.id)),
      removedNodes: fromData.nodes.filter((n) => !toNodeIds.has(n.id)),
      modifiedNodes: toData.nodes.filter((n) => fromNodeIds.has(n.id)),
      addedEdges: toData.edges.filter((e) => !fromEdgeIds.has(e.id)),
      removedEdges: fromData.edges.filter((e) => !toEdgeIds.has(e.id)),
      modifiedEdges: toData.edges.filter((e) => fromEdgeIds.has(e.id)),
    };

    const totalChanges =
      diff.addedNodes.length + diff.removedNodes.length + diff.modifiedNodes.length +
      diff.addedEdges.length + diff.removedEdges.length;

    const breakingChanges: string[] = [];
    for (const node of diff.removedNodes) {
      breakingChanges.push(`Removed node: ${node.name} (${node.type})`);
    }
    for (const node of diff.addedNodes) {
      if (node.type === 'database') breakingChanges.push(`Added database: ${node.name} — may require migration`);
    }

    return {
      fromVersion,
      toVersion,
      diff,
      summary: {
        totalChanges,
        structuralImpact: totalChanges > 10 ? 'high' : totalChanges > 5 ? 'medium' : 'low',
        breakingChanges,
      },
    };
  }

  /**
   * Rollback to a specific version.
   */
  async rollback(projectId: string, version: number): Promise<void> {
    const history = await this.list(projectId);
    const entry = history.find((v) => v.version === version);
    if (!entry) throw new Error(`Version ${version} not found`);

    const snapshot = await this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.id, entry.snapshotId))
      .limit(1);

    if (!snapshot[0]) throw new Error('Snapshot data missing');

    const data = snapshot[0].graphData as { nodes: GraphNode[]; edges: GraphEdge[] };

    // Clear current graph
    await this.db.delete(edges).where(eq(edges.projectId, projectId));
    await this.db.delete(nodes).where(eq(nodes.projectId, projectId));

    // Restore
    for (const node of data.nodes) {
      await this.db.insert(nodes).values(node as never);
    }
    for (const edge of data.edges) {
      await this.db.insert(edges).values(edge as never);
    }
  }
}
