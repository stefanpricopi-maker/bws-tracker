import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and, gte, desc } from 'drizzle-orm';
import { setupTestDb, initSchema, seedUser } from './db-helpers';
import { dailyLogs, workouts, userGoals } from '../../src/db/schema';
import { avg, calcBWSScore } from '../../src/lib/fitness';

const USER_ID = 1;

// ── helpers ───────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof setupTestDb>['db'];

async function seedLogs(db: Db, entries: { date: string; weightKg?: number; caloriesIn?: number; steps?: number; proteinG?: number }[]) {
  for (const e of entries) {
    await db.insert(dailyLogs).values({ userId: USER_ID, ...e });
  }
}

/** Runs the same query + score logic as GET /api/analytics */
async function computeAnalytics(db: Db) {
  const now      = new Date();
  const cutoff7  = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff7Str = cutoff7.toISOString().slice(0, 10);

  const [goals = null] = await db
    .select()
    .from(userGoals)
    .where(eq(userGoals.userId, USER_ID))
    .limit(1);

  const targetCalories = goals?.targetCaloriesKcal ?? 1850;
  const targetProtein  = goals?.targetProteinG     ?? 180;
  const targetSteps    = goals?.targetSteps        ?? 10_000;

  const logs7 = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), gte(dailyLogs.date, cutoff7Str)))
    .orderBy(desc(dailyLogs.date));

  const weightLogs = logs7.filter((l) => l.weightKg != null);
  const currentWeight = weightLogs[0]?.weightKg ?? null;
  const weight7dAgo   = weightLogs[weightLogs.length - 1]?.weightKg ?? null;
  const weightDelta7d =
    currentWeight != null && weight7dAgo != null && currentWeight !== weight7dAgo
      ? parseFloat((currentWeight - weight7dAgo).toFixed(2))
      : null;

  const avgCalories7d = Math.round(avg(logs7.map((l) => l.caloriesIn)));
  const avgProtein7d  = Math.round(avg(logs7.map((l) => l.proteinG)));
  const avgSteps7d    = Math.round(avg(logs7.map((l) => l.steps)));

  const workoutsCount = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, USER_ID), gte(workouts.date, cutoff7Str)));

  return calcBWSScore({
    weightDelta7d,
    avgCalories7d,
    avgProtein7d,
    avgSteps7d,
    workoutsLast7d: workoutsCount.length,
    targetCalories,
    targetProtein,
    targetSteps,
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('analytics integration', () => {
  let db: Db;
  let client: ReturnType<typeof setupTestDb>['client'];

  beforeEach(async () => {
    ({ db, client } = setupTestDb());
    await initSchema(client);
    await seedUser(client);
  });

  it('returns score 25 for a user with no data (only weight baseline)', async () => {
    const score = await computeAnalytics(db);
    // No delta → weightProgress = 25, rest = 0
    expect(score.bwsScore).toBe(25);
    expect(score.weightProgress).toBe(25);
    expect(score.nutritionScore).toBe(0);
  });

  it('increases nutrition score when calories logged near target', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await seedLogs(db, [{ date: today, caloriesIn: 1850 }]);

    const score = await computeAnalytics(db);
    expect(score.nutritionScore).toBe(25);
  });

  it('increases protein score when protein logged at target', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await seedLogs(db, [{ date: today, proteinG: 180 }]);

    const score = await computeAnalytics(db);
    expect(score.proteinScore).toBe(25);
  });

  it('increases activity score with steps and workouts', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await seedLogs(db, [{ date: today, steps: 10_000 }]);
    await db.insert(workouts).values({ userId: USER_ID, date: today, dayType: 'Push' });
    await db.insert(workouts).values({ userId: USER_ID, date: today, dayType: 'Pull' });
    await db.insert(workouts).values({ userId: USER_ID, date: today, dayType: 'Legs' });
    await db.insert(workouts).values({ userId: USER_ID, date: today, dayType: 'Upper' });

    const score = await computeAnalytics(db);
    expect(score.activityScore).toBe(25);
  });

  it('uses custom user_goals targets instead of defaults', async () => {
    await db.insert(userGoals).values({
      userId:              USER_ID,
      targetCaloriesKcal:  2000,
      targetProteinG:      200,
      targetSteps:         8_000,
    });

    const today = new Date().toISOString().slice(0, 10);
    // Log exactly the custom targets
    await seedLogs(db, [{ date: today, caloriesIn: 2000, proteinG: 200, steps: 8_000 }]);

    const score = await computeAnalytics(db);
    expect(score.nutritionScore).toBe(25);
    expect(score.proteinScore).toBe(25);
    // Steps hit custom 8k target → half of activity = 13
    expect(score.activityScore).toBeGreaterThanOrEqual(12);
  });

  it('caps score components at their maximum', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await seedLogs(db, [{ date: today, caloriesIn: 5000, proteinG: 500, steps: 50_000 }]);

    const score = await computeAnalytics(db);
    expect(score.nutritionScore).toBe(25);
    expect(score.proteinScore).toBe(25);
    expect(score.activityScore).toBeLessThanOrEqual(25);
  });
});
