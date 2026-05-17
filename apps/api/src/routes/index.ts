import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { authRoutes } from './auth.routes';
import { projectRoutes } from './project.routes';
import { graphRoutes } from './graph.routes';
import { agentRoutes } from './agent.routes';
import { ruleRoutes } from './rule.routes';
import { simulationRoutes } from './simulation.routes';
import { generationRoutes } from './generation.routes';
import { deploymentRoutes } from './deployment.routes';
import { evolutionRoutes } from './evolution.routes';
import { graphqlRoutes } from './graphql.routes';
import { wsHandler } from './ws-handler';
import './types';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health
  await app.register(healthRoutes);

  // Auth
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Projects (CRUD + members)
  await app.register(projectRoutes, { prefix: '/api/v1/projects' });

  // Graph engine routes
  await app.register(graphRoutes, { prefix: '/api/v1/projects' });

  // Agent runtime routes
  await app.register(agentRoutes, { prefix: '/api/v1/projects' });

  // Rule engine routes
  await app.register(ruleRoutes, { prefix: '/api/v1/projects' });

  // Simulation engine routes
  await app.register(simulationRoutes, { prefix: '/api/v1/projects' });

  // Generation engine + execution loop routes
  await app.register(generationRoutes, { prefix: '/api/v1/projects' });

  // Deployment engine routes
  await app.register(deploymentRoutes, { prefix: '/api/v1/projects' });

  // Evolution engine routes
  await app.register(evolutionRoutes, { prefix: '/api/v1/projects' });

  // GraphQL endpoint
  await app.register(graphqlRoutes, { prefix: '/api/v1' });

  // WebSocket handler for real-time canvas sync
  await wsHandler(app);
}
