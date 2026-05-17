import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import { env } from '@genesis-1/config';
import { createClient } from '@genesis-1/database';
import Redis from 'ioredis';
import { EventPublisher, EventSubscriber } from '@genesis-1/event-bus';
import { GraphEngine } from '@genesis-1/graph-engine';
import { RuleEngine } from '@genesis-1/rule-engine';
import { AgentRuntime, AgentOrchestrator } from '@genesis-1/agent-runtime';
import { SimulationEngine } from '@genesis-1/simulation-engine';
import { GenerationEngine } from '@genesis-1/generation-engine';
import { DeploymentEngine } from '@genesis-1/deployment-engine';
import { EvolutionEngine } from '@genesis-1/evolution-engine';
import { registerRoutes } from './routes';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    bodyLimit: 1024 * 1024,
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(websocket);

  // Swagger / OpenAPI
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Genesis OS API',
        version: '0.1.0',
        description: 'Graph-first visual software creation operating system. All APIs are project-scoped.',
      },
      servers: [{ url: `http://localhost:${env.API_PORT}`, description: 'Development' }],
      tags: [
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Graph', description: 'Graph engine — nodes, edges, traversal, snapshots, diagrams' },
        { name: 'Agents', description: 'Agent runtime — definitions, executions, orchestration' },
        { name: 'Rules', description: 'Rule engine — validation, evaluation, violations' },
        { name: 'Simulations', description: 'Runtime simulation engine' },
        { name: 'Generation', description: 'Graph→code generation (8 target stacks)' },
        { name: 'Deployment', description: 'Docker, Kubernetes, Terraform, CI/CD generation' },
        { name: 'Evolution', description: 'Architecture insights, self-healing, templates' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // Rate limiting
  await app.register(rateLimit, {
    global: false,
  });

  const db = createClient(env.DATABASE_URL, {
    poolMin: env.DATABASE_POOL_MIN,
    poolMax: env.DATABASE_POOL_MAX,
  });

  const redis = new Redis(env.REDIS_URL, {
    keyPrefix: env.REDIS_PREFIX,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  await redis.connect();

  // Event bus
  const eventPublisher = new EventPublisher(redis);
  const eventSubscriber = new EventSubscriber(redis);

  // Core engines
  const graphEngine = new GraphEngine({ db, eventBus: eventPublisher });
  const ruleEngine = new RuleEngine({ db, eventBus: eventPublisher });
  const agentRuntime = new AgentRuntime({ db, eventBus: eventPublisher });
  const simulationEngine = new SimulationEngine({ db, eventBus: eventPublisher });

  // Orchestrator & higher-order engines
  const orchestrator = new AgentOrchestrator({ db, eventBus: eventPublisher, graphEngine, ruleEngine });
  const generationEngine = new GenerationEngine(graphEngine, eventPublisher);
  const deploymentEngine = new DeploymentEngine(graphEngine, eventPublisher);
  const evolutionEngine = new EvolutionEngine(graphEngine, eventPublisher);

  // Decorators for route handlers
  app.decorate('db', db);
  app.decorate('redis', redis);
  app.decorate('eventPublisher', eventPublisher);
  app.decorate('eventSubscriber', eventSubscriber);
  app.decorate('graphEngine', graphEngine);
  app.decorate('ruleEngine', ruleEngine);
  app.decorate('agentRuntime', agentRuntime);
  app.decorate('orchestrator', orchestrator);
  app.decorate('simulationEngine', simulationEngine);
  app.decorate('generationEngine', generationEngine);
  app.decorate('deploymentEngine', deploymentEngine);
  app.decorate('evolutionEngine', evolutionEngine);

  await registerRoutes(app);

  return app;
}
