import { z } from 'zod';

export const createNodeSchema = z.object({
  nodeType: z.enum([
    'service',
    'database',
    'queue',
    'cache',
    'load_balancer',
    'cdn',
    'function',
    'container',
    'dns',
    'api_gateway',
    'rest_endpoint',
    'graphql_schema',
    'grpc_service',
    'event_topic',
    'event_subscription',
    'environment',
    'region',
    'cluster',
    'namespace',
    'pod',
    'module',
    'library',
    'package',
    'bounded_context',
    'aggregate_root',
    'domain_event',
  ]),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  properties: z.record(z.unknown()).optional().default({}),
  positionX: z.number().optional().default(0),
  positionY: z.number().optional().default(0),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateNodeSchema = z.object({
  nodeType: createNodeSchema.shape.nodeType.optional(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  properties: z.record(z.unknown()).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createEdgeSchema = z.object({
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  edgeType: z.enum([
    'depends_on',
    'communicates_with',
    'contains',
    'implements',
    'deployed_to',
    'triggers',
    'routes_to',
    'consumes_from',
    'produces_to',
  ]),
  label: z.string().max(200).optional(),
  properties: z.record(z.unknown()).optional().default({}),
  weight: z.number().min(0).optional().default(1),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateEdgeSchema = z.object({
  edgeType: createEdgeSchema.shape.edgeType.optional(),
  label: z.string().max(200).optional(),
  properties: z.record(z.unknown()).optional(),
  weight: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const bfsQuerySchema = z.object({
  startNodeId: z.string(),
  maxDepth: z.number().int().positive().optional().default(10),
});

export const shortestPathQuerySchema = z.object({
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
});

export const impactAnalysisQuerySchema = z.object({
  nodeId: z.string(),
});

export const createSnapshotSchema = z.object({
  label: z.string().min(1).max(200),
});

export const diffSnapshotsSchema = z.object({
  snapshotAId: z.string(),
  snapshotBId: z.string(),
});
