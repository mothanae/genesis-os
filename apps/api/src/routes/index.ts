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
import { authenticate } from '../plugins/auth';
import './types';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health (no auth required)
  await app.register(healthRoutes);

  // Auth (no auth required for login/register)
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  // WebSocket handler (handles its own token auth)
  await wsHandler(app);

  // GraphQL endpoint (optional auth)
  await app.register(graphqlRoutes, { prefix: '/api/v1' });

  // All project-scoped engine routes require authentication
  await app.register(async (scoped) => {
    scoped.addHook('preHandler', authenticate);

    await scoped.register(projectRoutes);
    await scoped.register(graphRoutes);
    await scoped.register(agentRoutes);
    await scoped.register(ruleRoutes);
    await scoped.register(simulationRoutes);
    await scoped.register(generationRoutes);
    await scoped.register(deploymentRoutes);
    await scoped.register(evolutionRoutes);
  }, { prefix: '/api/v1/projects' });
}
