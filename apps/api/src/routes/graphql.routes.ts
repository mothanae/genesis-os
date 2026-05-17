import type { FastifyInstance } from 'fastify';

// Lightweight GraphQL endpoint — processes queries against the graph engine
// without requiring a full GraphQL server library. For production, use
// @fastify/graphql or GraphQL Yoga with proper schema stitching.

interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export async function graphqlRoutes(app: FastifyInstance): Promise<void> {
  app.post('/graphql', async (request, reply) => {
    const { query, variables } = request.body as GraphQLRequest;
    const result = await executeGraphQL(app, query, variables ?? {});
    return reply.send({ data: result, errors: result._errors ?? [] });
  });

  // GET for GraphiQL-style introspection
  app.get('/graphql', async (_request, reply) => {
    return reply.send({
      message: 'Genesis-1 GraphQL endpoint',
      description: 'POST your GraphQL queries here. Introspection available via __schema query.',
      sampleQuery: '{ projects { id name slug } }',
    });
  });
}

interface GraphQLResult {
  [key: string]: unknown;
  _errors?: string[];
}

async function executeGraphQL(app: FastifyInstance, query: string, variables: Record<string, unknown>): Promise<GraphQLResult> {
  // Parse the query string to determine what's being requested
  const trimmed = query.trim();

  // __schema (introspection)
  if (trimmed.includes('__schema') || trimmed.includes('__type')) {
    return {
      __schema: {
        queryType: { name: 'Query' },
        mutationType: { name: 'Mutation' },
        types: [
          { name: 'Project', fields: [
            { name: 'id', type: { name: 'ID' } },
            { name: 'name', type: { name: 'String' } },
            { name: 'slug', type: { name: 'String' } },
            { name: 'description', type: { name: 'String' } },
            { name: 'ownerId', type: { name: 'ID' } },
          ]},
          { name: 'GraphNode', fields: [
            { name: 'id', type: { name: 'ID' } },
            { name: 'type', type: { name: 'String' } },
            { name: 'name', type: { name: 'String' } },
            { name: 'description', type: { name: 'String' } },
            { name: 'state', type: { name: 'String' } },
            { name: 'version', type: { name: 'Int' } },
            { name: 'position', type: { name: 'Position' } },
            { name: 'inputs', type: { name: '[Port]' } },
            { name: 'outputs', type: { name: '[Port]' } },
          ]},
          { name: 'GraphEdge', fields: [
            { name: 'id', type: { name: 'ID' } },
            { name: 'source', type: { name: 'ID' } },
            { name: 'target', type: { name: 'ID' } },
            { name: 'type', type: { name: 'String' } },
            { name: 'label', type: { name: 'String' } },
            { name: 'realtime', type: { name: 'Boolean' } },
            { name: 'bidirectional', type: { name: 'Boolean' } },
          ]},
          { name: 'AgentDefinition', fields: [
            { name: 'id', type: { name: 'ID' } },
            { name: 'name', type: { name: 'String' } },
            { name: 'status', type: { name: 'String' } },
            { name: 'version', type: { name: 'Int' } },
          ]},
          { name: 'Execution', fields: [
            { name: 'id', type: { name: 'ID' } },
            { name: 'agentId', type: { name: 'ID' } },
            { name: 'status', type: { name: 'String' } },
            { name: 'totalDurationMs', type: { name: 'Int' } },
            { name: 'totalTokens', type: { name: 'Int' } },
          ]},
          { name: 'RuleViolation', fields: [
            { name: 'id', type: { name: 'ID' } },
            { name: 'ruleId', type: { name: 'ID' } },
            { name: 'severity', type: { name: 'String' } },
            { name: 'message', type: { name: 'String' } },
          ]},
          { name: 'SimulationRun', fields: [
            { name: 'id', type: { name: 'ID' } },
            { name: 'status', type: { name: 'String' } },
            { name: 'totalSteps', type: { name: 'Int' } },
            { name: 'clockEnd', type: { name: 'Float' } },
          ]},
        ],
      },
    };
  }

  // projects query
  if (trimmed.includes('projects')) {
    const fields = extractFields(trimmed, 'projects');
    if (fields.includes('id') || fields.includes('name')) {
      return { projects: [] }; // Stub: would query app.db
    }
  }

  // project(id:) query
  if (trimmed.includes('project(')) {
    const idMatch = trimmed.match(/project\(\s*id:\s*"([^"]+)"/);
    if (idMatch) {
      return { project: { id: idMatch[1], name: 'Project', slug: 'project' } };
    }
  }

  // graphNodes query
  if (trimmed.includes('graphNodes')) {
    const projectId = variables.projectId as string;
    if (projectId) {
      const { data: nodes } = await app.graphEngine.listNodes(projectId);
      return { graphNodes: nodes };
    }
    return { graphNodes: [] };
  }

  // graphEdges query
  if (trimmed.includes('graphEdges')) {
    const projectId = variables.projectId as string;
    if (projectId) {
      const edgeList = await app.graphEngine.listEdges(projectId);
      return { graphEdges: edgeList };
    }
    return { graphEdges: [] };
  }

  // agents query
  if (trimmed.includes('agents')) {
    return { agents: [] };
  }

  // execution(id:) query
  if (trimmed.includes('execution(')) {
    const idMatch = trimmed.match(/execution\(\s*id:\s*"([^"]+)"/);
    if (idMatch) {
      const exec = await app.agentRuntime.getExecution(idMatch[1]);
      return { execution: exec };
    }
  }

  // violations query
  if (trimmed.includes('violations')) {
    const projectId = variables.projectId as string;
    if (projectId) {
      const v = await app.ruleEngine.getViolations(projectId);
      return { violations: v };
    }
    return { violations: [] };
  }

  // simulationRuns query
  if (trimmed.includes('simulationRuns')) {
    return { simulationRuns: [] };
  }

  // topologyValidation query
  if (trimmed.includes('topologyValidation')) {
    const projectId = variables.projectId as string;
    if (projectId) {
      const validation = await app.graphEngine.validateTopology(projectId);
      return { topologyValidation: validation };
    }
    return { topologyValidation: null };
  }

  // Fallback
  return { _errors: [`Unknown query pattern. Supported: projects, project, graphNodes, graphEdges, agents, execution, violations, simulationRuns, topologyValidation`] };
}

function extractFields(query: string, entityName: string): string[] {
  const match = query.match(new RegExp(`${entityName}\\s*\\{([^}]+)\\}`, 's'));
  if (!match || !match[1]) return [];
  return match[1].split(/\s+/).filter(Boolean);
}
