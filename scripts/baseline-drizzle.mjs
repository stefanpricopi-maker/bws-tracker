/**
 * Record all Drizzle journal migrations in __drizzle_migrations without re-running SQL.
 * Use when the schema was applied via scripts/migrate.mjs or manually on Turso.
 */
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, '..', 'drizzle');

const client = createClient({
  url: process.env['DATABASE_URL'] ?? 'file:./bws.db',
  ...(process.env['DATABASE_AUTH_TOKEN'] ? { authToken: process.env['DATABASE_AUTH_TOKEN'] } : {}),
});

const journal = JSON.parse(
  readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
);

const files = readMigrationFiles({ migrationsFolder });

await client.execute(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  created_at NUMERIC
)`);

let inserted = 0;
for (let i = 0; i < files.length; i++) {
  const m = files[i];
  const when = journal.entries[i]?.when ?? Date.now();
  const r = await client.execute({
    sql: 'INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    args: [m.hash, when],
  });
  if (r.rowsAffected) inserted++;
}

const countRow = (await client.execute('SELECT COUNT(*) AS n FROM __drizzle_migrations')).rows[0];
const n = countRow?.n ?? countRow?.[0] ?? '?';
console.log(`[baseline] ${inserted} new row(s); ${n} total in __drizzle_migrations.`);
