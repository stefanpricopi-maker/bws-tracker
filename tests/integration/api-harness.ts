import { vi } from 'vitest';
import { setupTestDb, initSchema, seedUser } from './db-helpers';

const state = vi.hoisted(() => ({
  db: null as ReturnType<typeof setupTestDb>['db'] | null,
  client: null as ReturnType<typeof setupTestDb>['client'] | null,
}));

vi.mock('../../src/db', () => ({
  get db() {
    if (!state.db) throw new Error('Test DB not initialised — call resetApiTestDb() in beforeEach.');
    return state.db;
  },
}));

vi.mock('../../src/lib/apiAuth', () => ({
  requireUser: vi.fn(async () => ({ userId: 1 })),
}));

export async function resetApiTestDb() {
  const { db, client } = setupTestDb();
  state.db = db;
  state.client = client;
  await initSchema(client);
  await seedUser(client);
}

export function getTestDb() {
  if (!state.db || !state.client) {
    throw new Error('Test DB not initialised — call resetApiTestDb() in beforeEach.');
  }
  return { db: state.db, client: state.client };
}

export function jsonRequest(
  method: string,
  body?: unknown,
  url = 'http://localhost/api',
): Request {
  return new Request(url, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

export async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
