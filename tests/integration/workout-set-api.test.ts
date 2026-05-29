import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb, resetApiTestDb, jsonRequest, readJson } from './api-harness';
import { POST as postWorkoutSet, DELETE as deleteWorkoutSet } from '../../src/pages/api/workout-set';
import { workoutSets, workouts } from '../../src/db/schema';

describe('POST /api/workout-set', () => {
  beforeEach(resetApiTestDb);

  it('rejects invalid payload', async () => {
    const res = await postWorkoutSet({
      request: jsonRequest('POST', { exercise_name: '', weight: 80, reps: 8, set_number: 1 }),
    } as Parameters<typeof postWorkoutSet>[0]);

    expect(res.status).toBe(400);
    const body = await readJson<{ error: string }>(res);
    expect(body.error).toMatch(/exercise_name/i);
  });

  it('creates workout and saves set with optional rpe', async () => {
    const res = await postWorkoutSet({
      request: jsonRequest('POST', {
        exercise_name: 'Dumbbell Floor Press',
        weight:        40,
        reps:          10,
        set_number:    1,
        day_type:      'Push',
        rpe:           8,
      }),
    } as Parameters<typeof postWorkoutSet>[0]);

    expect(res.status).toBe(201);
    const body = await readJson<{ workout_id: number }>(res);
    expect(body.workout_id).toBeGreaterThan(0);

    const sets = await getTestDb().db.select().from(workoutSets);
    expect(sets).toHaveLength(1);
    expect(sets[0].exerciseName).toBe('Dumbbell Floor Press');
    expect(sets[0].rpe).toBe(8);
  });

  it('appends to existing workout_id', async () => {
    const first = await postWorkoutSet({
      request: jsonRequest('POST', {
        exercise_name: 'Dumbbell Floor Press',
        weight:        40,
        reps:          10,
        set_number:    1,
        day_type:      'Push',
      }),
    } as Parameters<typeof postWorkoutSet>[0]);
    const { workout_id } = await readJson<{ workout_id: number }>(first);

    const second = await postWorkoutSet({
      request: jsonRequest('POST', {
        workout_id,
        exercise_name: 'Dumbbell Floor Press',
        weight:        42.5,
        reps:          8,
        set_number:    2,
      }),
    } as Parameters<typeof postWorkoutSet>[0]);

    expect(second.status).toBe(201);
    const sets = await getTestDb().db.select().from(workoutSets);
    expect(sets).toHaveLength(2);
  });
});

describe('DELETE /api/workout-set', () => {
  beforeEach(resetApiTestDb);

  it('removes partial workout on quit', async () => {
    const postRes = await postWorkoutSet({
      request: jsonRequest('POST', {
        exercise_name: 'Dumbbell Floor Press',
        weight:        40,
        reps:          10,
        set_number:    1,
        day_type:      'Push',
      }),
    } as Parameters<typeof postWorkoutSet>[0]);
    const { workout_id } = await readJson<{ workout_id: number }>(postRes);

    const delRes = await deleteWorkoutSet({
      request: new Request(`http://localhost/api/workout-set?workout_id=${workout_id}`),
      url:     new URL(`http://localhost/api/workout-set?workout_id=${workout_id}`),
    } as Parameters<typeof deleteWorkoutSet>[0]);

    expect(delRes.status).toBe(200);
    const remaining = await getTestDb().db.select().from(workouts).where(eq(workouts.id, workout_id));
    expect(remaining).toHaveLength(0);
  });
});
