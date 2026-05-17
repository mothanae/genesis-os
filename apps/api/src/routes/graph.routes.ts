import type { FastifyInstance } from 'fastify';
import { createNodeSchema, createEdgeSchema } from '@genesis-1/shared/schemas';
import { ArchitectureDiagrams, VersionHistory } from '@genesis-1/graph-engine';

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  // ── Nodes ─────────────────────────────────────────────────────

  app.get('/:projectId/graph/nodes', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await app.graphEngine.listNodes(projectId);
    return reply.send({ success: true, data: result.data, meta: { page: 1, pageSize: 50, total: result.total, totalPages: Math.ceil(result.total / 50) } });
  });

  app.post('/:projectId/graph/nodes', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = createNodeSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    const node = await app.graphEngine.createNode(projectId, body.data);
    return reply.status(201).send({ success: true, data: node });
  });

  app.get('/:projectId/graph/nodes/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const node = await app.graphEngine.getNode(nodeId);
    if (!node) return reply.status(404).send({ success: false, error: 'Node not found' });
    return reply.send({ success: true, data: node });
  });

  app.patch('/:projectId/graph/nodes/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const node = await app.graphEngine.updateNode(nodeId, request.body as Record<string, unknown>);
    return reply.send({ success: true, data: node });
  });

  app.delete('/:projectId/graph/nodes/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    await app.graphEngine.deleteNode(nodeId);
    return reply.send({ success: true, data: { message: 'Node deleted' } });
  });

  // ── Edges ─────────────────────────────────────────────────────

  app.get('/:projectId/graph/edges', async (request, reply) => {
    return reply.send({ success: true, data: [] });
  });

  app.post('/:projectId/graph/edges', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = createEdgeSchema.safeParse(request.body);
    if (!body.success) return reply.status(422).send({ success: false, error: 'Validation error', details: body.error.flatten() });

    const edge = await app.graphEngine.createEdge(projectId, body.data);
    return reply.status(201).send({ success: true, data: edge });
  });

  app.delete('/:projectId/graph/edges/:edgeId', async (request, reply) => {
    const { edgeId } = request.params as { edgeId: string };
    await app.graphEngine.deleteEdge(edgeId);
    return reply.send({ success: true, data: { message: 'Edge deleted' } });
  });

  // ── Search ────────────────────────────────────────────────────

  app.get('/:projectId/graph/search', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { q } = request.query as { q?: string };
    const results = await app.graphEngine.searchNodes(projectId, q ?? '');
    return reply.send({ success: true, data: results });
  });

  // ── Snapshots ─────────────────────────────────────────────────

  app.get('/:projectId/graph/snapshots', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const snapshots = await app.graphEngine.listSnapshots(projectId);
    return reply.send({ success: true, data: snapshots });
  });

  app.post('/:projectId/graph/snapshots', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { label } = request.body as { label: string };
    const snapshot = await app.graphEngine.createSnapshot(projectId, label ?? 'Snapshot');
    return reply.status(201).send({ success: true, data: snapshot });
  });

  app.get('/:projectId/graph/snapshots/:snapId', async (request, reply) => {
    const { snapId } = request.params as { snapId: string };
    const snapshot = await app.graphEngine.getSnapshot(snapId);
    if (!snapshot) return reply.status(404).send({ success: false, error: 'Snapshot not found' });
    return reply.send({ success: true, data: snapshot });
  });

  app.post('/:projectId/graph/snapshots/diff', async (request, reply) => {
    const { snapshotAId, snapshotBId } = request.body as { snapshotAId: string; snapshotBId: string };
    const diff = await app.graphEngine.diffSnapshots(snapshotAId, snapshotBId);
    return reply.send({ success: true, data: diff });
  });

  // ── Analysis ──────────────────────────────────────────────────

  app.post('/:projectId/graph/analyze/cycles', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const cycles = await app.graphEngine.detectCycles(projectId);
    return reply.send({ success: true, data: cycles });
  });

  app.post('/:projectId/graph/analyze/impact', async (request, reply) => {
    const { nodeId } = request.body as { nodeId: string };
    const impact = await app.graphEngine.impactAnalysis(nodeId);
    return reply.send({ success: true, data: impact });
  });

  // ── Diagrams ──────────────────────────────────────────────────

  app.post('/:projectId/graph/diagram', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      format?: string;
      direction?: string;
      title?: string;
      showPorts?: boolean;
      showRuntime?: boolean;
      groupByEnvironment?: boolean;
    };

    const { data: nodes } = await app.graphEngine.listNodes(projectId);
    const edges = await app.graphEngine.listEdges(projectId);

    const diagrams = new ArchitectureDiagrams();
    const result = diagrams.generate(nodes, edges as unknown as Parameters<typeof diagrams.generate>[1], {
      format: (body.format as 'mermaid') ?? 'mermaid',
      direction: (body.direction as 'TB') ?? 'TB',
      title: body.title ?? 'Architecture Diagram',
      showPorts: body.showPorts ?? true,
      showRuntime: body.showRuntime ?? false,
      groupByEnvironment: body.groupByEnvironment ?? false,
    });

    // Also generate in all formats if requested
    const allFormats = body.format === 'all' ? {
      mermaid: diagrams.generate(nodes, edges as unknown as Parameters<typeof diagrams.generate>[1], { ...body, format: 'mermaid' } as Parameters<typeof diagrams.generate>[2]),
      graphviz: diagrams.generate(nodes, edges as unknown as Parameters<typeof diagrams.generate>[1], { ...body, format: 'graphviz' } as Parameters<typeof diagrams.generate>[2]),
      d2: diagrams.generate(nodes, edges as unknown as Parameters<typeof diagrams.generate>[1], { ...body, format: 'd2' } as Parameters<typeof diagrams.generate>[2]),
      plantuml: diagrams.generate(nodes, edges as unknown as Parameters<typeof diagrams.generate>[1], { ...body, format: 'plantuml' } as Parameters<typeof diagrams.generate>[2]),
    } : undefined;

    return reply.send({
      success: true,
      data: {
        diagram: result,
        format: body.format ?? 'mermaid',
        allFormats,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    });
  });

  // ── Version History ─────────────────────────────────────────

  app.post('/:projectId/graph/versions/snapshot', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { message, author } = request.body as { message?: string; author?: string };

    const versionHistory = new VersionHistory(app.db);
    const entry = await versionHistory.snapshot(projectId, message ?? 'Manual snapshot', author);
    return reply.send({ success: true, data: entry });
  });

  app.get('/:projectId/graph/versions', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const versionHistory = new VersionHistory(app.db);
    const versions = await versionHistory.list(projectId);
    return reply.send({ success: true, data: versions });
  });

  app.post('/:projectId/graph/versions/compare', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { fromVersion, toVersion } = request.body as { fromVersion: number; toVersion: number };

    const versionHistory = new VersionHistory(app.db);
    const comparison = await versionHistory.compare(projectId, fromVersion, toVersion);
    return reply.send({ success: true, data: comparison });
  });

  app.post('/:projectId/graph/versions/rollback', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { version } = request.body as { version: number };

    const versionHistory = new VersionHistory(app.db);
    await versionHistory.rollback(projectId, version);
    return reply.send({ success: true, data: { message: `Rolled back to version ${version}` } });
  });
}
