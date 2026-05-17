import type { DatabaseClient } from '@genesis-1/database';
import { nodes, edges, branches, snapshots, flows, flowExecutions } from '@genesis-1/database';
import type { EventPublisher } from '@genesis-1/event-bus';
import type {
  GraphNode,
  GraphEdge,
  GraphBranch,
  GraphSnapshot,
  GraphFlow,
  FlowExecution,
  CycleResult,
  ImpactAnalysisResult,
  DependencyChain,
  GraphDiff,
  TopologyValidation,
  GraphValidationError,
  GraphValidationWarning,
  GraphSuggestion,
} from '@genesis-1/shared';
import { EventType } from '@genesis-1/shared';
import { eq, and, sql, inArray, not } from 'drizzle-orm';
import { GraphValidator } from './validator';

export interface GraphEngineConfig {
  db: DatabaseClient;
  eventBus: EventPublisher;
}

export class GraphEngine {
  private readonly validator = new GraphValidator();

  constructor(private readonly config: GraphEngineConfig) {}

  // ═══════════════════════════════════════════════════════════════
  // Node CRUD
  // ═══════════════════════════════════════════════════════════════

  async createNode(
    projectId: string,
    input: {
      type: string;
      name: string;
      subtype?: string;
      description?: string;
      position?: { x: number; y: number };
      inputs?: unknown[];
      outputs?: unknown[];
      metadata?: Record<string, unknown>;
      runtime?: Record<string, unknown> | null;
      deployment?: Record<string, unknown> | null;
      state?: string;
      parentId?: string;
      branchId?: string;
    },
    userId?: string,
  ): Promise<GraphNode> {
    const result = await this.config.db
      .insert(nodes)
      .values({
        projectId,
        type: input.type,
        subtype: input.subtype,
        name: input.name,
        description: input.description,
        positionX: input.position?.x ?? 0,
        positionY: input.position?.y ?? 0,
        inputs: (input.inputs ?? []) as never[],
        outputs: (input.outputs ?? []) as never[],
        metadata: (input.metadata ?? {}) as never,
        runtime: (input.runtime ?? null) as never,
        deployment: (input.deployment ?? null) as never,
        state: input.state ?? 'draft',
        parentId: input.parentId,
        branchId: input.branchId,
      })
      .returning();

    const node = result[0]!;
    await this.publish(EventType.NodeCreated, projectId, { nodeId: node.id, type: node.type, name: node.name }, userId);
    return this.mapNode(node);
  }

  async updateNode(
    nodeId: string,
    input: Partial<{
      type: string;
      name: string;
      description: string;
      position: { x: number; y: number };
      inputs: unknown[];
      outputs: unknown[];
      metadata: Record<string, unknown>;
      runtime: Record<string, unknown> | null;
      deployment: Record<string, unknown> | null;
      state: string;
    }>,
    userId?: string,
  ): Promise<GraphNode | null> {
    const updates: Record<string, unknown> = {};
    if (input.type !== undefined) updates.type = input.type;
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.position) {
      updates.positionX = input.position.x;
      updates.positionY = input.position.y;
    }
    if (input.inputs !== undefined) updates.inputs = input.inputs;
    if (input.outputs !== undefined) updates.outputs = input.outputs;
    if (input.metadata !== undefined) updates.metadata = input.metadata;
    if (input.runtime !== undefined) updates.runtime = input.runtime;
    if (input.deployment !== undefined) updates.deployment = input.deployment;
    if (input.state !== undefined) updates.state = input.state;
    updates.updatedAt = new Date();

    const result = await this.config.db
      .update(nodes)
      .set(updates as never)
      .where(eq(nodes.id, nodeId))
      .returning();

    if (!result[0]) return null;
    const node = result[0];
    await this.publish(EventType.NodeUpdated, node.projectId, { nodeId: node.id, type: node.type, changes: Object.keys(updates) }, userId);
    return this.mapNode(node);
  }

  async deleteNode(nodeId: string, userId?: string): Promise<void> {
    const node = await this.config.db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    if (!node[0]) return;

    // Cascade: delete all edges connected to this node
    await this.config.db
      .delete(edges)
      .where(sql`${edges.source} = ${nodeId} OR ${edges.target} = ${nodeId}`);

    await this.config.db.delete(nodes).where(eq(nodes.id, nodeId));
    await this.publish(EventType.NodeDeleted, node[0].projectId, { nodeId, type: node[0].type, name: node[0].name }, userId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Edge CRUD
  // ═══════════════════════════════════════════════════════════════

  async createEdge(
    projectId: string,
    input: {
      source: string;
      target: string;
      type: string;
      label?: string;
      realtime?: boolean;
      bidirectional?: boolean;
      weight?: number;
      metadata?: Record<string, unknown>;
    },
    userId?: string,
  ): Promise<GraphEdge> {
    const result = await this.config.db
      .insert(edges)
      .values({
        projectId,
        source: input.source,
        target: input.target,
        type: input.type,
        label: input.label,
        realtime: input.realtime ?? false,
        bidirectional: input.bidirectional ?? false,
        weight: input.weight ?? 1.0,
        metadata: (input.metadata ?? {}) as never,
      })
      .returning();

    const edge = result[0]!;
    await this.publish(EventType.EdgeCreated, projectId, { edgeId: edge.id, source: edge.source, target: edge.target, type: edge.type }, userId);

    // Auto-create reverse edge if bidirectional
    if (input.bidirectional) {
      await this.config.db.insert(edges).values({
        projectId,
        source: input.target,
        target: input.source,
        type: input.type,
        bidirectional: true,
        weight: input.weight ?? 1.0,
      });
    }

    return this.mapEdge(edge);
  }

  async updateEdge(
    edgeId: string,
    input: Partial<{ type: string; label: string; weight: number; realtime: boolean; metadata: Record<string, unknown> }>,
    userId?: string,
  ): Promise<GraphEdge | null> {
    const result = await this.config.db
      .update(edges)
      .set({ ...input, updatedAt: new Date() } as never)
      .where(eq(edges.id, edgeId))
      .returning();

    if (!result[0]) return null;
    const edge = result[0];
    await this.publish(EventType.EdgeUpdated, edge.projectId, { edgeId: edge.id, changes: Object.keys(input) }, userId);
    return this.mapEdge(edge);
  }

  async deleteEdge(edgeId: string, userId?: string): Promise<void> {
    const edge = await this.config.db.select().from(edges).where(eq(edges.id, edgeId)).limit(1);
    if (!edge[0]) return;

    await this.config.db.delete(edges).where(eq(edges.id, edgeId));
    await this.publish(EventType.EdgeRemoved, edge[0].projectId, { edgeId }, userId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  async getNode(nodeId: string): Promise<GraphNode | null> {
    const result = await this.config.db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    return result[0] ? this.mapNode(result[0]) : null;
  }

  async getEdge(edgeId: string): Promise<GraphEdge | null> {
    const result = await this.config.db.select().from(edges).where(eq(edges.id, edgeId)).limit(1);
    return result[0] ? this.mapEdge(result[0]) : null;
  }

  async listNodes(
    projectId: string,
    filters?: { type?: string; state?: string; branchId?: string },
    limit = 100,
    offset = 0,
  ): Promise<{ data: GraphNode[]; total: number }> {
    const conditions = [eq(nodes.projectId, projectId)];
    if (filters?.type) conditions.push(eq(nodes.type, filters.type));
    if (filters?.state) conditions.push(eq(nodes.state, filters.state));
    if (filters?.branchId) conditions.push(eq(nodes.branchId, filters.branchId));

    const [data, countResult] = await Promise.all([
      this.config.db.select().from(nodes).where(and(...conditions)).limit(limit).offset(offset),
      this.config.db
        .select({ count: sql<number>`count(*)` })
        .from(nodes)
        .where(and(...conditions)),
    ]);

    return {
      data: data.map((n) => this.mapNode(n)),
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async listEdges(
    projectId: string,
    filters?: { type?: string; nodeId?: string },
  ): Promise<GraphEdge[]> {
    const conditions = [eq(edges.projectId, projectId)];
    if (filters?.type) conditions.push(eq(edges.type, filters.type));
    if (filters?.nodeId) {
      conditions.push(
        sql`(${edges.source} = ${filters.nodeId} OR ${edges.target} = ${filters.nodeId})`,
      );
    }

    const result = await this.config.db
      .select()
      .from(edges)
      .where(and(...conditions));
    return result.map((e) => this.mapEdge(e));
  }

  async searchNodes(projectId: string, query: string): Promise<GraphNode[]> {
    const result = await this.config.db
      .select()
      .from(nodes)
      .where(
        and(
          eq(nodes.projectId, projectId),
          sql`(${nodes.name} ILIKE ${`%${query}%`} OR ${nodes.type} ILIKE ${`%${query}%`} OR ${nodes.description} ILIKE ${`%${query}%`})`,
        ),
      )
      .limit(20);
    return result.map((n) => this.mapNode(n));
  }

  // ═══════════════════════════════════════════════════════════════
  // Branching
  // ═══════════════════════════════════════════════════════════════

  async createBranch(
    projectId: string,
    name: string,
    description?: string,
    parentBranchId?: string,
  ): Promise<GraphBranch> {
    // Create snapshot of current graph state as base
    const allNodes = await this.listNodes(projectId);
    const allEdges = await this.listEdges(projectId);
    const snapshot = await this.createSnapshot(projectId, `branch-${name}-base`, `Base snapshot for branch "${name}"`);

    const result = await this.config.db
      .insert(branches)
      .values({
        projectId,
        name,
        description,
        parentBranchId,
        baseSnapshotId: snapshot.id,
        isDefault: false,
      })
      .returning();

    const branch = result[0]!;
    await this.publish(EventType.GraphBranchCreated, projectId, { branchId: branch.id, name });
    return branch as unknown as GraphBranch;
  }

  async listBranches(projectId: string): Promise<GraphBranch[]> {
    const result = await this.config.db.select().from(branches).where(eq(branches.projectId, projectId));
    return result as unknown as GraphBranch[];
  }

  async mergeBranch(branchId: string, targetBranchId: string, userId?: string): Promise<void> {
    const branch = await this.config.db.select().from(branches).where(eq(branches.id, branchId)).limit(1);
    if (!branch[0]) throw new Error('Branch not found');

    // Apply all nodes/edges from branch to target
    const branchNodes = await this.config.db.select().from(nodes).where(eq(nodes.branchId, branchId));
    for (const node of branchNodes) {
      await this.config.db
        .update(nodes)
        .set({ branchId: targetBranchId } as never)
        .where(eq(nodes.id, node.id));
    }

    await this.config.db.delete(branches).where(eq(branches.id, branchId));
    await this.publish(EventType.GraphBranchMerged, branch[0].projectId, { branchId, targetBranchId }, userId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Snapshots
  // ═══════════════════════════════════════════════════════════════

  async createSnapshot(
    projectId: string,
    label: string,
    description?: string,
    branchId?: string,
  ): Promise<GraphSnapshot> {
    const allNodes = await this.listNodes(projectId);
    const allEdges = await this.listEdges(projectId);

    const result = await this.config.db
      .insert(snapshots)
      .values({
        projectId,
        branchId,
        label,
        description,
        nodeCount: allNodes.data.length,
        edgeCount: allEdges.length,
        graphData: { nodes: allNodes.data, edges: allEdges } as never,
      })
      .returning();

    const snapshot = result[0]!;
    await this.publish(EventType.GraphSnapshotCreated, projectId, { snapshotId: snapshot.id, label, nodeCount: snapshot.nodeCount });
    return snapshot as unknown as GraphSnapshot;
  }

  async listSnapshots(projectId: string): Promise<GraphSnapshot[]> {
    const result = await this.config.db.select().from(snapshots).where(eq(snapshots.projectId, projectId));
    return result as unknown as GraphSnapshot[];
  }

  async getSnapshot(snapshotId: string): Promise<GraphSnapshot | null> {
    const result = await this.config.db.select().from(snapshots).where(eq(snapshots.id, snapshotId)).limit(1);
    return (result[0] as unknown as GraphSnapshot) ?? null;
  }

  async diffSnapshots(snapshotAId: string, snapshotBId: string): Promise<GraphDiff> {
    const [a, b] = await Promise.all([this.getSnapshot(snapshotAId), this.getSnapshot(snapshotBId)]);
    if (!a || !b) throw new Error('One or both snapshots not found');

    const aNodeIds = new Set(a.graphData.nodes.map((n) => n.id));
    const bNodeIds = new Set(b.graphData.nodes.map((n) => n.id));
    const aEdgeIds = new Set(a.graphData.edges.map((e) => e.id));
    const bEdgeIds = new Set(b.graphData.edges.map((e) => e.id));

    return {
      addedNodes: b.graphData.nodes.filter((n) => !aNodeIds.has(n.id)),
      removedNodes: a.graphData.nodes.filter((n) => !bNodeIds.has(n.id)),
      modifiedNodes: b.graphData.nodes.filter(
        (n) =>
          aNodeIds.has(n.id) &&
          JSON.stringify(n) !==
            JSON.stringify(a.graphData.nodes.find((an) => an.id === n.id)),
      ),
      addedEdges: b.graphData.edges.filter((e) => !aEdgeIds.has(e.id)),
      removedEdges: a.graphData.edges.filter((e) => !bEdgeIds.has(e.id)),
      modifiedEdges: [],
    };
  }

  async restoreSnapshot(snapshotId: string, userId?: string): Promise<void> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) throw new Error('Snapshot not found');

    await this.config.db.delete(edges).where(eq(edges.projectId, snapshot.projectId));
    await this.config.db.delete(nodes).where(eq(nodes.projectId, snapshot.projectId));

    for (const node of snapshot.graphData.nodes) {
      await this.config.db.insert(nodes).values(this.nodeToDb(node, snapshot.projectId) as never);
    }
    for (const edge of snapshot.graphData.edges) {
      await this.config.db.insert(edges).values(this.edgeToDb(edge, snapshot.projectId) as never);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Traversal
  // ═══════════════════════════════════════════════════════════════

  async bfs(startNodeId: string, maxDepth = 10): Promise<GraphNode[]> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];
    const result: GraphNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth > maxDepth) continue;
      visited.add(current.id);

      const node = await this.getNode(current.id);
      if (node) result.push(node);

      const outgoingEdges = await this.config.db
        .select()
        .from(edges)
        .where(eq(edges.source, current.id));

      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          queue.push({ id: edge.target, depth: current.depth + 1 });
        }
      }
    }
    return result;
  }

  async dfs(startNodeId: string, maxDepth = 10): Promise<GraphNode[]> {
    const visited = new Set<string>();
    const result: GraphNode[] = [];
    await this.dfsRecurse(startNodeId, 0, maxDepth, visited, result);
    return result;
  }

  private async dfsRecurse(
    nodeId: string,
    depth: number,
    maxDepth: number,
    visited: Set<string>,
    result: GraphNode[],
  ): Promise<void> {
    if (visited.has(nodeId) || depth > maxDepth) return;
    visited.add(nodeId);

    const node = await this.getNode(nodeId);
    if (node) result.push(node);

    const outgoingEdges = await this.config.db
      .select()
      .from(edges)
      .where(eq(edges.source, nodeId));

    for (const edge of outgoingEdges) {
      await this.dfsRecurse(edge.target, depth + 1, maxDepth, visited, result);
    }
  }

  async shortestPath(
    sourceId: string,
    targetId: string,
  ): Promise<{ path: string[]; edges: GraphEdge[] } | null> {
    const result = await this.config.db.execute<{
      path: string[];
      edge_ids: string[];
      total_weight: number;
    }>(
      sql`WITH RECURSIVE path_search AS (
          SELECT source, target, ARRAY[source] AS path, ARRAY[id::text] AS edge_ids, weight AS total_weight
          FROM graph.edges WHERE source = ${sourceId}
          UNION ALL
          SELECT e.source, e.target, ps.path || e.source, ps.edge_ids || e.id::text, ps.total_weight + e.weight
          FROM graph.edges e
          JOIN path_search ps ON e.source = ps.target
          WHERE NOT e.target = ANY(ps.path)
            AND array_length(ps.path, 1) < 50
        )
        SELECT path || target AS path, edge_ids, total_weight
        FROM path_search WHERE target = ${targetId}
        ORDER BY total_weight ASC LIMIT 1`,
    );

    const row = (result as any).rows[0] as { path: string[]; edge_ids: string[] } | undefined;
    if (!row) return null;

    const edgeList: GraphEdge[] = [];
    for (const edgeId of row.edge_ids) {
      const edge = await this.getEdge(edgeId);
      if (edge) edgeList.push(edge);
    }

    return { path: row.path, edges: edgeList };
  }

  async ancestors(nodeId: string): Promise<DependencyChain> {
    const node = await this.getNode(nodeId);
    const chain: DependencyChain['chain'] = [];

    const result = await this.config.db.execute<{
      node_id: string;
      node_name: string;
      depth: number;
      edge_type: string;
    }>(
      sql`WITH RECURSIVE ancestor_search AS (
          SELECT source AS node_id, 1 AS depth, type AS edge_type
          FROM graph.edges WHERE target = ${nodeId}
          UNION ALL
          SELECT e.source, a.depth + 1, e.type
          FROM graph.edges e
          JOIN ancestor_search a ON e.target = a.node_id
          WHERE a.depth < 50
        )
        SELECT DISTINCT ON (node_id) node_id, depth, edge_type
        FROM ancestor_search ORDER BY node_id, depth ASC`,
    );

    for (const row of (result as any).rows as Array<{ node_id: string; node_name: string; depth: number; edge_type: string }>) {
      const ancestorNode = await this.getNode(row.node_id);
      chain.push({
        nodeId: row.node_id,
        nodeName: ancestorNode?.name ?? row.node_id,
        depth: row.depth,
        edgeType: row.edge_type as unknown as GraphEdge['type'],
      });
    }

    return { nodeId, direction: 'upstream', chain };
  }

  async descendants(nodeId: string): Promise<DependencyChain> {
    const node = await this.getNode(nodeId);
    const chain: DependencyChain['chain'] = [];

    const result = await this.config.db.execute<{
      node_id: string;
      node_name: string;
      depth: number;
      edge_type: string;
    }>(
      sql`WITH RECURSIVE descendant_search AS (
          SELECT target AS node_id, 1 AS depth, type AS edge_type
          FROM graph.edges WHERE source = ${nodeId}
          UNION ALL
          SELECT e.target, d.depth + 1, e.type
          FROM graph.edges e
          JOIN descendant_search d ON e.source = d.node_id
          WHERE d.depth < 50
        )
        SELECT DISTINCT ON (node_id) node_id, depth, edge_type
        FROM descendant_search ORDER BY node_id, depth ASC`,
    );

    for (const row of (result as any).rows as Array<{ node_id: string; node_name: string; depth: number; edge_type: string }>) {
      const descNode = await this.getNode(row.node_id);
      chain.push({
        nodeId: row.node_id,
        nodeName: descNode?.name ?? row.node_id,
        depth: row.depth,
        edgeType: row.edge_type as unknown as GraphEdge['type'],
      });
    }

    return { nodeId, direction: 'downstream', chain };
  }

  // ═══════════════════════════════════════════════════════════════
  // Analysis
  // ═══════════════════════════════════════════════════════════════

  async detectCycles(projectId: string): Promise<CycleResult[]> {
    const result = await this.config.db.execute<{
      path: string[];
      node_ids: string[];
      edge_ids: string[];
    }>(
      sql`WITH RECURSIVE cycle_search AS (
          SELECT source, target,
                 ARRAY[source] AS path,
                 ARRAY[source] AS node_ids,
                 ARRAY[id::text] AS edge_ids,
                 false AS has_cycle
          FROM graph.edges WHERE project_id = ${projectId}
          UNION ALL
          SELECT e.source, e.target,
                 cs.path || e.source,
                 cs.node_ids || e.source,
                 cs.edge_ids || e.id::text,
                 e.target = ANY(cs.node_ids)
          FROM graph.edges e
          JOIN cycle_search cs ON e.source = cs.target
          WHERE NOT cs.has_cycle AND array_length(cs.node_ids, 1) < 50
        )
        SELECT DISTINCT path, node_ids, edge_ids FROM cycle_search WHERE has_cycle`,
    );

    const cycles: CycleResult[] = ((result as any).rows as Array<{
      path: string[];
      node_ids: string[];
      edge_ids: string[];
    }>).map((row) => ({
      path: row.path,
      nodeIds: row.node_ids,
      edgeIds: row.edge_ids,
      length: row.node_ids.length,
    }));

    if (cycles.length > 0) {
      await this.publish(EventType.GraphCycleDetected, projectId, { cycleCount: cycles.length });
    }

    return cycles;
  }

  async impactAnalysis(nodeId: string): Promise<ImpactAnalysisResult> {
    const result = await this.config.db.execute<{
      affected_ids: string[];
      depth: number;
      cascading_ids: string[];
    }>(
      sql`WITH RECURSIVE downstream AS (
          SELECT target AS affected_id, 1 AS depth,
                 ARRAY[${nodeId}, target] AS path,
                 ARRAY[target] AS cascading_ids
          FROM graph.edges WHERE source = ${nodeId}
          UNION ALL
          SELECT e.target, d.depth + 1,
                 d.path || e.target,
                 d.cascading_ids || e.target
          FROM graph.edges e
          JOIN downstream d ON e.source = d.affected_id
          WHERE NOT e.target = ANY(d.path) AND d.depth < 50
        )
        SELECT
          array_agg(DISTINCT affected_id) AS affected_ids,
          max(depth) AS depth,
          array_agg(DISTINCT affected_id) AS cascading_ids
        FROM downstream`,
    );

    const row = (result as any).rows[0] as { affected_ids: string[]; depth: number; cascading_ids: string[] } | undefined;

    // Collect edges involved
    const affectedNodes = row?.affected_ids ?? [];
    let affectedEdges: string[] = [];
    if (affectedNodes.length > 0) {
      const edgeResult = await this.config.db
        .select({ id: edges.id })
        .from(edges)
        .where(
          and(
            inArray(edges.source, affectedNodes as never[]),
            inArray(edges.target, affectedNodes as never[]),
          ),
        );
      affectedEdges = edgeResult.map((e) => e.id);
    }

    return {
      nodeId,
      affectedNodes,
      affectedEdges,
      depth: row?.depth ?? 0,
      totalAffected: affectedNodes.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Topology Validation
  // ═══════════════════════════════════════════════════════════════

  async validateTopology(projectId: string): Promise<TopologyValidation> {
    const allNodes = await this.listNodes(projectId);
    const allEdges = await this.listEdges(projectId);
    const cycles = await this.detectCycles(projectId);

    const result = this.validator.validate(allNodes.data, allEdges, cycles);

    await this.publish(EventType.GraphTopologyValidated, projectId, {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Flow Execution
  // ═══════════════════════════════════════════════════════════════

  async createFlow(
    projectId: string,
    name: string,
    entryNodeId: string,
    nodeIds: string[],
  ): Promise<GraphFlow> {
    const result = await this.config.db
      .insert(flows)
      .values({ projectId, name, entryNodeId, nodes: nodeIds })
      .returning();
    return result[0] as unknown as GraphFlow;
  }

  async startFlow(flowId: string): Promise<FlowExecution> {
    const flow = await this.config.db.select().from(flows).where(eq(flows.id, flowId)).limit(1);
    if (!flow[0]) throw new Error('Flow not found');

    const result = await this.config.db
      .insert(flowExecutions)
      .values({
        flowId,
        projectId: flow[0].projectId,
        status: 'running',
        currentNodeId: flow[0].entryNodeId,
      })
      .returning();

    const exec = result[0]!;
    await this.publish(EventType.FlowStarted, flow[0].projectId, {
      flowId,
      executionId: exec.id,
      entryNodeId: flow[0].entryNodeId,
    });

    return exec as unknown as FlowExecution;
  }

  // ═══════════════════════════════════════════════════════════════
  // Mappers
  // ═══════════════════════════════════════════════════════════════

  private mapNode(row: typeof nodes.$inferSelect): GraphNode {
    return {
      id: row.id,
      projectId: row.projectId,
      type: row.type as GraphNode['type'],
      subtype: row.subtype ?? undefined,
      name: row.name,
      description: row.description,
      metadata: row.metadata as Record<string, unknown>,
      position: { x: row.positionX, y: row.positionY },
      inputs: (row.inputs as GraphNode['inputs']) ?? [],
      outputs: (row.outputs as GraphNode['outputs']) ?? [],
      dependencies: row.dependencies ?? [],
      relationships: row.relationships ?? [],
      runtime: row.runtime as GraphNode['runtime'],
      deployment: row.deployment as GraphNode['deployment'],
      state: row.state,
      version: row.version,
      parentId: row.parentId,
      branchId: row.branchId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapEdge(row: typeof edges.$inferSelect): GraphEdge {
    return {
      id: row.id,
      projectId: row.projectId,
      source: row.source,
      target: row.target,
      type: row.type as GraphEdge['type'],
      label: row.label,
      metadata: row.metadata as Record<string, unknown> | undefined,
      realtime: row.realtime ?? false,
      bidirectional: row.bidirectional ?? false,
      weight: row.weight ?? 1.0,
      properties: row.properties as Record<string, unknown> | undefined,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private nodeToDb(node: GraphNode, projectId: string) {
    return {
      id: node.id,
      projectId,
      type: node.type,
      subtype: node.subtype,
      name: node.name,
      description: node.description,
      metadata: node.metadata as never,
      positionX: node.position.x,
      positionY: node.position.y,
      inputs: node.inputs as never[],
      outputs: node.outputs as never[],
      dependencies: node.dependencies,
      relationships: node.relationships,
      runtime: node.runtime as never,
      deployment: node.deployment as never,
      state: node.state,
      version: node.version,
      parentId: node.parentId,
      branchId: node.branchId,
    };
  }

  private edgeToDb(edge: GraphEdge, projectId: string) {
    return {
      id: edge.id,
      projectId,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
      metadata: edge.metadata as never,
      realtime: edge.realtime ?? false,
      bidirectional: edge.bidirectional ?? false,
      weight: edge.weight ?? 1.0,
      properties: edge.properties as never,
      version: edge.version,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Event Helper
  // ═══════════════════════════════════════════════════════════════

  private async publish(
    type: EventType,
    projectId: string,
    payload: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    await this.config.eventBus.publish(`genesis-1.${type.replace(/^genesis-1\./, '')}` as never, {
      id: crypto.randomUUID(),
      type,
      source: 'graph-engine',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      projectId,
      userId,
      payload,
      metadata: { version: 1, priority: 'normal' },
    });
  }
}
