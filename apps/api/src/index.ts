import { buildApp } from './app';
import { env } from '@genesis-1/config';

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`Genesis-1 API running on http://${env.API_HOST}:${env.API_PORT}`);
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
