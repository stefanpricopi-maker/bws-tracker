import { defineConfig } from 'drizzle-kit';

// Local dev:      DATABASE_URL=file:./bws.db  (no auth token needed)
// Production:     DATABASE_URL=libsql://...   DATABASE_AUTH_TOKEN=...
const url       = process.env.DATABASE_URL       ?? 'file:./bws.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

export default defineConfig({
  dialect: 'turso',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url,
    ...(authToken ? { authToken } : {}),
  },
});
