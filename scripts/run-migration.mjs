import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://genesis1:genesis1_dev@localhost:5432/genesis1';
const migrationFile = process.argv[2] ?? join(__dirname, 'migrations', '001-create-missing-tables.sql');

const sql = readFileSync(migrationFile, 'utf-8');
const client = postgres(DATABASE_URL);

console.log(`Running migration: ${migrationFile}`);
console.log(`Database: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);

try {
  await client.unsafe(sql);
  console.log('Migration complete.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
