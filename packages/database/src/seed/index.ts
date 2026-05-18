import { eq } from 'drizzle-orm';
import { createClient } from '../client';
import { env } from '@genesis-1/config';
import { users } from '../schema/auth';
import { projects } from '../schema/project';
import { nodes, edges } from '../schema/graph';
import { ruleSets, ruleDefinitions } from '../schema/rule';
import { agentDefinitions } from '../schema/agent';

async function seed() {
  const db = createClient(env.DATABASE_URL);

  console.log('Seeding demo data...');

  // 1. Demo admin user
  await db.insert(users).values({
    email: 'demo@genesis-1.dev',
    passwordHash: '$2b$14$dummyhashfordevelopmentuseonly',
    displayName: 'Demo User',
    role: 'admin',
  }).onConflictDoNothing();
  console.log('  ✓ Demo user');

  // 2. Demo project (owned by demo user)
  const [owner] = await db.select().from(users).where(eq(users.email, 'demo@genesis-1.dev')).limit(1);

  const [project] = await db.insert(projects).values({
    name: 'Demo App',
    slug: 'demo-app',
    description: 'A sample full-stack application built with Genesis-1',
    ownerId: owner!.id,
    settings: {},
  }).returning();
  const projectId = project!.id;
  console.log('  ✓ Demo project');

  // 3. Sample graph: a full-stack web app architecture
  const nodeData = [
    { id: 'n-db', type: 'database', name: 'PostgreSQL', positionX: 100, positionY: 200, inputs: [], outputs: [{ id: 'p1', name: 'data', type: 'data', schema: {}, required: true }], runtime: {}, deployment: {} },
    { id: 'n-cache', type: 'cache', name: 'Redis Cache', positionX: 100, positionY: 400, inputs: [], outputs: [{ id: 'p2', name: 'cache', type: 'data', schema: {}, required: false }], runtime: {}, deployment: {} },
    { id: 'n-svc', type: 'service', name: 'API Service', positionX: 350, positionY: 200, inputs: [{ id: 'p3', name: 'data', type: 'data', schema: {}, required: true }], outputs: [{ id: 'p4', name: 'response', type: 'http', schema: {}, required: true }], runtime: { port: 3000, replicas: 2, memory: '256Mi' }, deployment: {} },
    { id: 'n-gw', type: 'api_gateway', name: 'API Gateway', positionX: 600, positionY: 100, inputs: [], outputs: [{ id: 'p5', name: 'route', type: 'http', schema: {}, required: true }], runtime: { port: 8080 }, deployment: {} },
    { id: 'n-page-dash', type: 'page', name: 'Dashboard', positionX: 600, positionY: 300, inputs: [], outputs: [], runtime: {}, deployment: {} },
    { id: 'n-page-login', type: 'page', name: 'Login', positionX: 850, positionY: 200, inputs: [], outputs: [], runtime: {}, deployment: {} },
    { id: 'n-comp-table', type: 'component', name: 'UsersTable', positionX: 850, positionY: 400, inputs: [], outputs: [], runtime: {}, deployment: {} },
  ];

  for (const n of nodeData) {
    await db.insert(nodes).values({
      id: n.id,
      projectId,
      type: n.type as never,
      name: n.name,
      positionX: n.positionX,
      positionY: n.positionY,
      inputs: n.inputs as never,
      outputs: n.outputs as never,
      runtime: n.runtime as never,
      deployment: n.deployment as never,
    });
  }
  console.log(`  ✓ ${nodeData.length} graph nodes`);

  // 4. Sample edges
  const edgeData = [
    { id: 'e1', source: 'n-svc', target: 'n-db', type: 'depends_on', projectId },
    { id: 'e2', source: 'n-svc', target: 'n-cache', type: 'depends_on', projectId },
    { id: 'e3', source: 'n-gw', target: 'n-svc', type: 'routes_to', projectId },
    { id: 'e4', source: 'n-page-dash', target: 'n-svc', type: 'depends_on', projectId },
    { id: 'e5', source: 'n-page-login', target: 'n-gw', type: 'depends_on', projectId },
    { id: 'e6', source: 'n-comp-table', target: 'n-page-dash', type: 'belongs_to', projectId },
  ];

  for (const e of edgeData) {
    await db.insert(edges).values({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type as never,
      projectId: e.projectId,
    });
  }
  console.log(`  ✓ ${edgeData.length} graph edges`);

  // 5. Rule set with architecture validation rules
  const [ruleSet] = await db.insert(ruleSets).values({
    projectId,
    name: 'Graph Architecture Validator',
    description: 'Validates graph topology, connectivity, and architectural patterns',
    evaluationStrategy: 'all-match',
  }).returning();

  const rules = [
    { ruleSetId: ruleSet!.id, projectId, name: 'no_cyclic_dependencies', description: 'Prevent circular dependencies', domain: 'graph', condition: { not: { any: { var: 'cycles' } } }, action: { type: 'violation', severity: 'error', message: 'Cycle detected — remove one edge to break the cycle' }, priority: 1, evaluationMode: 'reactive' },
    { ruleSetId: ruleSet!.id, projectId, name: 'has_api_gateway', description: 'Services should be behind an API gateway', domain: 'graph', condition: { gte: [{ var: 'apiGatewayCount' }, 1] }, action: { type: 'violation', severity: 'warning', message: 'No API gateway found — add one to route external traffic' }, priority: 2, evaluationMode: 'reactive' },
    { ruleSetId: ruleSet!.id, projectId, name: 'has_authentication', description: 'Public-facing apps should have authentication', domain: 'security', condition: { eq: [{ var: 'hasAuthentication' }, true] }, action: { type: 'violation', severity: 'warning', message: 'No authentication node detected — add auth to protect user data' }, priority: 3, evaluationMode: 'reactive' },
    { ruleSetId: ruleSet!.id, projectId, name: 'no_orphans', description: 'Every node should have at least one connection', domain: 'graph', condition: { gte: [{ var: 'nodeCount' }, 0] }, action: { type: 'violation', severity: 'warning', message: 'Orphaned nodes detected — connect them or remove them' }, priority: 4, evaluationMode: 'reactive' },
  ];

  for (const r of rules) {
    await db.insert(ruleDefinitions).values(r as never);
  }
  console.log(`  ✓ Rule set with ${rules.length} rules`);

  // 6. Sample agent definition
  await db.insert(agentDefinitions).values({
    projectId,
    name: 'Full-Stack Generator',
    description: 'Generates frontend, backend, and database code from the graph',
    graphDefinition: {
      nodes: [
        { id: 'step-1', type: 'input', label: 'Graph Input', config: {} },
        { id: 'step-2', type: 'function', label: 'Validate Architecture', config: { function: 'validateTopology' } },
        { id: 'step-3', type: 'function', label: 'Generate Database', config: { function: 'generateDatabase' } },
        { id: 'step-4', type: 'function', label: 'Generate Backend', config: { function: 'generateBackend' } },
        { id: 'step-5', type: 'function', label: 'Generate Frontend', config: { function: 'generateFrontend' } },
        { id: 'step-6', type: 'output', label: 'Generated Code', config: {} },
      ],
      edges: [
        { id: 'ae1', source: 'step-1', target: 'step-2' },
        { id: 'ae2', source: 'step-2', target: 'step-3' },
        { id: 'ae3', source: 'step-3', target: 'step-4' },
        { id: 'ae4', source: 'step-4', target: 'step-5' },
        { id: 'ae5', source: 'step-5', target: 'step-6' },
      ],
    },
    toolsConfig: [],
    modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7 },
    prompts: { system: 'You are a full-stack code generator. Generate production-ready code from architecture graphs.' },
  });
  console.log('  ✓ Agent definition');

  console.log('\nSeed complete. Demo project ready at /dashboard/projects/' + projectId);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
