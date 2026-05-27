/**
 * Run all pending Drizzle migration SQL files against the LibSQL/SQLite database.
 * Called automatically at container startup before the Astro server starts.
 */
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'drizzle');

const client = createClient({
  url: process.env['DATABASE_URL'] ?? 'file:/data/bws.db',
  ...(process.env['DATABASE_AUTH_TOKEN'] ? { authToken: process.env['DATABASE_AUTH_TOKEN'] } : {}),
});

const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let applied = 0;
for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (e) {
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate column')) {
        console.error(`[migrate] Error in ${file}:`, e.message);
      }
    }
  }
  applied++;
}

console.log(`[migrate] Applied ${applied} migration file(s). DB ready.`);

// Ensure the default user (id=1) always exists
try {
  await client.execute(`INSERT OR IGNORE INTO users (id, name) VALUES (1, 'Stefan')`);
  console.log('[migrate] Default user ensured.');
} catch (e) {
  console.error('[migrate] Could not seed default user:', e.message);
}
