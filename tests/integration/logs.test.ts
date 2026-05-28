import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and, desc } from 'drizzle-orm';
import { setupTestDb, initSchema, seedUser } from './db-helpers';
import { dailyLogs } from '../../src/db/schema';

const USER_ID = 1;

// ── helpers that mirror logs.ts logic ────────────────────────────────────────

async function upsertLog(
  db: ReturnType<typeof setupTestDb>['db'],
  date: string,
  patch: {
    weightKg?: number;
    steps?: number;
    caloriesIn?: number;
    proteinG?: number;
  },
) {
  const [existing] = await db
    .select({ id: dailyLogs.id })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), eq(dailyLogs.date, date)))
    .limit(1);

  if (existing) {
    await db.update(dailyLogs).set(patch).where(eq(dailyLogs.id, existing.id));
  } else {
    await db.insert(dailyLogs).values({ userId: USER_ID, date, ...patch });
  }

  const [row] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), eq(dailyLogs.date, date)))
    .limit(1);
  return row;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('daily_logs integration', () => {
  let db: ReturnType<typeof setupTestDb>['db'];
  let client: ReturnType<typeof setupTestDb>['client'];

  beforeEach(async () => {
    ({ db, client } = setupTestDb());
    await initSchema(client);
    await seedUser(client);
  });

  it('inserts a new log row', async () => {
    const row = await upsertLog(db, '2024-01-15', { caloriesIn: 1700, steps: 9500 });
    expect(row.date).toBe('2024-01-15');
    expect(row.caloriesIn).toBe(1700);
    expect(row.steps).toBe(9500);
    expect(row.userId).toBe(USER_ID);
  });

  it('updates an existing row on the same date (upsert)', async () => {
    await upsertLog(db, '2024-01-15', { caloriesIn: 1700 });
    const updated = await upsertLog(db, '2024-01-15', { caloriesIn: 1900, steps: 11000 });

    expect(updated.caloriesIn).toBe(1900);
    expect(updated.steps).toBe(11000);

    // Only one row should exist for this date
    const all = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, USER_ID), eq(dailyLogs.date, '2024-01-15')));
    expect(all.length).toBe(1);
  });

  it('does not overwrite fields not included in the patch', async () => {
    await upsertLog(db, '2024-01-15', { weightKg: 84.5 });
    const updated = await upsertLog(db, '2024-01-15', { steps: 12000 });

    // Weight was set in first call and steps in second — both should be present
    expect(updated.weightKg).toBe(84.5);
    expect(updated.steps).toBe(12000);
  });

  it('stores multiple logs on different dates', async () => {
    await upsertLog(db, '2024-01-14', { caloriesIn: 1800 });
    await upsertLog(db, '2024-01-15', { caloriesIn: 1750 });
    await upsertLog(db, '2024-01-16', { caloriesIn: 1820 });

    const all = await db
      .select()
      .from(dailyLogs)
      .where(eq(dailyLogs.userId, USER_ID))
      .orderBy(desc(dailyLogs.date));

    expect(all.length).toBe(3);
    expect(all[0].date).toBe('2024-01-16');
    expect(all[2].date).toBe('2024-01-14');
  });

  it('isolates logs per user (foreign key check)', async () => {
    // Insert another user and verify their logs don't appear for user 1
    await client.execute(`INSERT INTO users (id, name) VALUES (2, 'Other')`);
    await db.insert(dailyLogs).values({ userId: 2, date: '2024-01-15', caloriesIn: 3000 });

    const user1Logs = await db
      .select()
      .from(dailyLogs)
      .where(eq(dailyLogs.userId, USER_ID));

    expect(user1Logs.length).toBe(0);
  });
});
