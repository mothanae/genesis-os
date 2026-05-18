import type { FastifyInstance } from 'fastify';
import { createYoga, createSchema } from 'graphql-yoga';
import { projects, agentDefinitions, simulationRuns } from '@genesis-1/database';
import { eq, desc } from 'drizzle-orm';

// ── Schema ───────────────────────────────────────────────────

const typeDefs = `
  type Project {
    id: ID!
    name: String!
    slug: String!
    description: String
    ownerId: ID!
    createdAt: String
    updatedAt: String
  }

  type Position {
    x: Float!
    y: Float!
  }

  type Port {
    name: String!
    type: String!
    required: Boolean
  }

  type GraphNode {
    id: ID!
    type: String!
    name: String!
    description: String
    state: String
    version: Int
    position: Position
    inputs: [Port]
    outputs: [Port]
    runtime: JSON
    deployment: JSON
  }

  type GraphEdge {
    id: ID!
    source: ID!
    target: ID!
    type: String!
    label: String
    realtime: Boolean
    bidirectional: Boolean
    weight: Float
  }

  type AgentDefinition {
    id: ID!
    name: String!
    description: String
    status: String!
    version: Int!
    createdAt: String
    updatedAt: String
  }

  type Execution {
    id: ID!
    agentId: ID!
    status: String!
    input: JSON
    output: JSON
    totalDurationMs: Int
    totalTokens: Int
    startedAt: String
    completedAt: String
  }

  type ExecutionStep {
    id: ID!
    stepType: String!
    label: String
    status: String!
    output: JSON
    error: String
    durationMs: Int
    tokenCount: Int
  }

  type RuleViolation {
    id: ID!
    ruleId: ID!
    severity: String!
    message: String!
    nodeId: ID
    edgeId: ID
    createdAt: String
  }

  type SimulationRun {
    id: ID!
    simulationId: ID!
    projectId: ID!
    status: String!
    totalSteps: Int!
    clockEnd: Float
    metrics: JSON
    startedAt: String
    completedAt: String
  }

  type TopologyValidation {
    valid: Boolean!
    errors: [String]
    warnings: [String]
  }

  scalar JSON

  type Query {
    projects: [Project!]!
    project(id: ID!): Project
    graphNodes(projectId: ID!): [GraphNode!]!
    graphEdges(projectId: ID!): [GraphEdge!]!
    agents(projectId: ID): [AgentDefinition!]!
    execution(id: ID!): Execution
    executionSteps(executionId: ID!): [ExecutionStep!]
    violations(projectId: ID!): [RuleViolation!]
    simulationRuns(projectId: ID!): [SimulationRun!]
    topologyValidation(projectId: ID!): TopologyValidation
  }

  input CreateProjectInput {
    name: String!
    description: String
  }

  input UpdateProjectInput {
    name: String
    description: String
  }

  input CreateNodeInput {
    type: String!
    name: String!
    description: String
    positionX: Float
    positionY: Float
    properties: JSON
  }

  input CreateEdgeInput {
    source: ID!
    target: ID!
    type: String!
    label: String
    weight: Float
  }

  type Mutation {
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, input: UpdateProjectInput!): Project!
    deleteProject(id: ID!): Boolean!
    createNode(projectId: ID!, input: CreateNodeInput!): GraphNode!
    deleteNode(projectId: ID!, nodeId: ID!): Boolean!
    createEdge(projectId: ID!, input: CreateEdgeInput!): GraphEdge!
    deleteEdge(projectId: ID!, edgeId: ID!): Boolean!
    executeAgent(projectId: ID!, agentId: ID!, input: JSON): Execution!
    runValidation(projectId: ID!): TopologyValidation!
  }
`;

export async function graphqlRoutes(app: FastifyInstance): Promise<void> {
  const schema = createSchema({
    typeDefs,
    resolvers: {
      Query: {
        projects: async () => {
          return app.db.select().from(projects).orderBy(desc(projects.updatedAt)).limit(50);
        },

        project: async (_root: unknown, args: { id: string }) => {
          const result = await app.db
            .select()
            .from(projects)
            .where(eq(projects.id, args.id))
            .limit(1);
          return result[0] ?? null;
        },

        graphNodes: async (_root: unknown, args: { projectId: string }) => {
          const { data: nodes } = await app.graphEngine.listNodes(args.projectId);
          return nodes;
        },

        graphEdges: async (_root: unknown, args: { projectId: string }) => {
          return app.graphEngine.listEdges(args.projectId);
        },

        agents: async (_root: unknown, args: { projectId?: string }) => {
          if (args.projectId) {
            return app.db
              .select()
              .from(agentDefinitions)
              .where(eq(agentDefinitions.projectId, args.projectId))
              .orderBy(desc(agentDefinitions.updatedAt));
          }
          return app.db
            .select()
            .from(agentDefinitions)
            .orderBy(desc(agentDefinitions.updatedAt))
            .limit(20);
        },

        execution: async (_root: unknown, args: { id: string }) => {
          return app.agentRuntime.getExecution(args.id);
        },

        executionSteps: async (_root: unknown, args: { executionId: string }) => {
          return app.agentRuntime.getExecutionSteps?.(args.executionId) ?? [];
        },

        violations: async (_root: unknown, args: { projectId: string }) => {
          return app.ruleEngine.getViolations(args.projectId);
        },

        simulationRuns: async (_root: unknown, args: { projectId: string }) => {
          return app.db
            .select()
            .from(simulationRuns)
            .where(eq(simulationRuns.projectId, args.projectId))
            .orderBy(desc(simulationRuns.createdAt))
            .limit(20);
        },

        topologyValidation: async (_root: unknown, args: { projectId: string }) => {
          return app.graphEngine.validateTopology(args.projectId);
        },
      },

      Mutation: {
        createProject: async (_root: unknown, args: { input: { name: string; description?: string } }, ctx: { userId: string | null }) => {
          const userId = requireAuth(ctx);
          const slug = args.input.name.toLowerCase().replace(/\s+/g, '-');
          const [row] = await app.db
            .insert(projects)
            .values({
              name: args.input.name,
              slug,
              description: args.input.description ?? null,
              ownerId: userId,
            } as never)
            .returning();
          return row;
        },

        updateProject: async (_root: unknown, args: { id: string; input: { name?: string; description?: string } }, ctx: { userId: string | null }) => {
          requireAuth(ctx);
          const [row] = await app.db
            .update(projects)
            .set({ ...args.input, updatedAt: new Date() } as never)
            .where(eq(projects.id, args.id))
            .returning();
          return row ?? null;
        },

        deleteProject: async (_root: unknown, args: { id: string }, ctx: { userId: string | null }) => {
          requireAuth(ctx);
          await app.db.delete(projects).where(eq(projects.id, args.id));
          return true;
        },

        createNode: async (_root: unknown, args: { projectId: string; input: { type: string; name: string; description?: string; positionX?: number; positionY?: number; properties?: Record<string, unknown> } }, ctx: { userId: string | null }) => {
          const userId = requireAuth(ctx);
          return app.graphEngine.createNode(args.projectId, {
            type: args.input.type,
            name: args.input.name,
            description: args.input.description ?? undefined,
            position: { x: args.input.positionX ?? 0, y: args.input.positionY ?? 0 },
            metadata: args.input.properties ?? {},
            inputs: [],
            outputs: [],
          }, userId);
        },

        deleteNode: async (_root: unknown, args: { projectId: string; nodeId: string }, ctx: { userId: string | null }) => {
          const userId = requireAuth(ctx);
          await app.graphEngine.deleteNode(args.nodeId, userId);
          return true;
        },

        createEdge: async (_root: unknown, args: { projectId: string; input: { source: string; target: string; type: string; label?: string; weight?: number } }, ctx: { userId: string | null }) => {
          const userId = requireAuth(ctx);
          return app.graphEngine.createEdge(args.projectId, {
            source: args.input.source,
            target: args.input.target,
            type: args.input.type,
            label: args.input.label ?? undefined,
            weight: args.input.weight ?? 1,
            metadata: {},
          }, userId);
        },

        deleteEdge: async (_root: unknown, args: { projectId: string; edgeId: string }, ctx: { userId: string | null }) => {
          const userId = requireAuth(ctx);
          await app.graphEngine.deleteEdge(args.edgeId, userId);
          return true;
        },

        executeAgent: async (_root: unknown, args: { projectId: string; agentId: string; input?: Record<string, unknown> }, ctx: { userId: string | null }) => {
          const userId = requireAuth(ctx);
          return app.agentRuntime.startExecution(args.agentId, args.projectId, userId, args.input ?? {});
        },

        runValidation: async (_root: unknown, args: { projectId: string }, ctx: { userId: string | null }) => {
          requireAuth(ctx);
          return app.graphEngine.validateTopology(args.projectId);
        },
      },
    },
  });

  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/api/v1/graphql',
    context: async ({ request: webReq }: { request: Request }) => {
      // Extract auth info from headers into context for resolvers
      const authHeader = webReq.headers.get('authorization');
      const apiKey = webReq.headers.get('x-api-key');
      let userId: string | null = null;

      if (apiKey) {
        try {
          const result = await app.apiKeyService.verifyApiKey(apiKey);
          if (result) userId = result.userId;
        } catch { /* not authenticated */ }
      } else if (authHeader?.startsWith('Bearer ')) {
        try {
          const payload = app.authService.verifyAccessToken(authHeader.slice(7));
          userId = payload.sub;
        } catch { /* not authenticated */ }
      }

      return { userId };
    },
    graphiql: {
      defaultQuery: `# Genesis-1 GraphQL API
# Explore projects, graph topology, agents, simulations, and more.

{
  projects {
    id
    name
    slug
  }
}
`,
    },
  });

  // Mount yoga as a Fastify route handler
  app.route({
    method: ['GET', 'POST', 'OPTIONS'],
    url: '/graphql',
    handler: async (request, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(request, reply);
      return response;
    },
  });
}

/** Require auth for mutations. Throws GraphQL error if no authenticated user in context. */
function requireAuth(ctx: { userId: string | null }): string {
  if (!ctx.userId) {
    throw new Error('Authentication required for mutations. Provide an Authorization: Bearer <token> or X-API-Key header.');
  }
  return ctx.userId;
}
