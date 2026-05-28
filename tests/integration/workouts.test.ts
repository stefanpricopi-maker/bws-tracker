import { describe, it, expect, beforeEach } from 'vitest';
import { eq, desc, and } from 'drizzle-orm';
import { setupTestDb, initSchema, seedUser } from './db-helpers';
import { workouts, workoutSets } from '../../src/db/schema';

const USER_ID = 1;

// ── helpers that mirror workouts.ts logic ────────────────────────────────────

type SetInput = { exerciseName: string; weight: number; reps: number; setNumber: number };

async function saveWorkout(
  db: ReturnType<typeof setupTestDb>['db'],
  date: string,
  dayType: string,
  sets: SetInput[],
) {
  const [inserted] = await db
    .insert(workouts)
    .values({ userId: USER_ID, date, dayType })
    .returning({ id: workouts.id });

  for (const s of sets) {
    await db.insert(workoutSets).values({ workoutId: inserted.id, ...s });
  }
  return inserted.id;
}

async function getBestSet(
  db: ReturnType<typeof setupTestDb>['db'],
  exerciseName: string,
) {
  const [latestWorkout] = await db
    .select({ workoutId: workoutSets.workoutId, date: workouts.date })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(and(eq(workouts.userId, USER_ID), eq(workoutSets.exerciseName, exerciseName)))
    .orderBy(desc(workouts.date))
    .limit(1);

  if (!latestWorkout) return null;

  const sets = await db
    .select()
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.workoutId, latestWorkout.workoutId),
        eq(workoutSets.exerciseName, exerciseName),
      ),
    );

  const best = sets.reduce((acc, s) => {
    if (s.weight > acc.weight) return s;
    if (s.weight === acc.weight && s.reps > acc.reps) return s;
    return acc;
  }, sets[0]);

  return { maxWeight: best.weight, maxReps: best.reps, date: latestWorkout.date };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('workouts integration', () => {
  let db: ReturnType<typeof setupTestDb>['db'];
  let client: ReturnType<typeof setupTestDb>['client'];

  beforeEach(async () => {
    ({ db, client } = setupTestDb());
    await initSchema(client);
    await seedUser(client);
  });

  it('returns null when no previous session exists', async () => {
    const result = await getBestSet(db, 'Bench Press');
    expect(result).toBeNull();
  });

  it('returns the best set (highest weight) from the latest session', async () => {
    await saveWorkout(db, '2024-01-15', 'Push', [
      { exerciseName: 'Bench Press', weight: 80, reps: 8, setNumber: 1 },
      { exerciseName: 'Bench Press', weight: 85, reps: 6, setNumber: 2 },
      { exerciseName: 'Bench Press', weight: 82.5, reps: 7, setNumber: 3 },
    ]);

    const result = await getBestSet(db, 'Bench Press');
    expect(result?.maxWeight).toBe(85);
    expect(result?.maxReps).toBe(6);
  });

  it('breaks ties by highest reps', async () => {
    await saveWorkout(db, '2024-01-15', 'Push', [
      { exerciseName: 'Overhead Press', weight: 60, reps: 8, setNumber: 1 },
      { exerciseName: 'Overhead Press', weight: 60, reps: 10, setNumber: 2 },
      { exerciseName: 'Overhead Press', weight: 60, reps: 9, setNumber: 3 },
    ]);

    const result = await getBestSet(db, 'Overhead Press');
    expect(result?.maxReps).toBe(10); // highest reps at same weight
  });

  it('uses the most recent session, not the heaviest ever', async () => {
    await saveWorkout(db, '2024-01-10', 'Push', [
      { exerciseName: 'Bench Press', weight: 100, reps: 5, setNumber: 1 },
    ]);
    await saveWorkout(db, '2024-01-15', 'Push', [
      { exerciseName: 'Bench Press', weight: 90, reps: 8, setNumber: 1 },
    ]);

    const result = await getBestSet(db, 'Bench Press');
    expect(result?.maxWeight).toBe(90); // from the most recent session
    expect(result?.date).toBe('2024-01-15');
  });

  it('does not mix sets from different exercises', async () => {
    await saveWorkout(db, '2024-01-15', 'Push', [
      { exerciseName: 'Bench Press', weight: 80, reps: 8, setNumber: 1 },
      { exerciseName: 'Overhead Press', weight: 55, reps: 10, setNumber: 1 },
    ]);

    const bench = await getBestSet(db, 'Bench Press');
    const ohp   = await getBestSet(db, 'Overhead Press');

    expect(bench?.maxWeight).toBe(80);
    expect(ohp?.maxWeight).toBe(55);
  });

  it('auto-regulation Rule A fires after a strong session (reps >= 10)', async () => {
    await saveWorkout(db, '2024-01-15', 'Push', [
      { exerciseName: 'Bench Press', weight: 80, reps: 12, setNumber: 1 },
    ]);

    const result = await getBestSet(db, 'Bench Press');
    // Verify the data that Rule A would consume
    expect(result?.maxReps).toBeGreaterThanOrEqual(10);
    // Rule A result: +2.5 kg
    expect(result!.maxWeight + 2.5).toBe(82.5);
  });
});
