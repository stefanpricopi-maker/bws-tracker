import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Local dev:   DATABASE_URL=file:./bws.db   (relative path, no auth token)
// Production:  DATABASE_URL=libsql://...    DATABASE_AUTH_TOKEN=...
const url       = process.env.DATABASE_URL       ?? 'file:./bws.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url,
  ...(authToken ? { authToken } : {}),
});

export const db = drizzle(client, { schema });

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION NOTE
// LibSQL queries are ASYNC — all Drizzle calls in API routes must be awaited:
//
//   Before:  const rows = db.select().from(users).all();
//   After:   const rows = await db.select().from(users);
//
// The `.all()` / `.get()` / `.run()` suffixes are NOT used with LibSQL;
// the query builder itself returns a Promise when awaited.
// ─────────────────────────────────────────────────────────────────────────────
