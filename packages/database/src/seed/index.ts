import { createClient } from '../client';
import { env } from '@genesis-1/config';

async function seed() {
  const db = createClient(env.DATABASE_URL);

  // Seed demo user
  console.log('Seeding demo user...');
  await db.insert(db.schema.users).values({
    email: 'demo@genesis-1.dev',
    passwordHash: '$2b$14$dummyhashfordevelopmentuseonly',
    displayName: 'Demo User',
    role: 'admin',
  }).onConflictDoNothing();

  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
