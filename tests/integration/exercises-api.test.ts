import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, resetApiTestDb, jsonRequest, readJson } from './api-harness';
import { GET as getExercises, POST as postExercise } from '../../src/pages/api/exercises';
import { exercises } from '../../src/db/schema';

describe('/api/exercises', () => {
  beforeEach(async () => {
    await resetApiTestDb();
    await getTestDb().db.insert(exercises).values([
      { name: 'Alpha Push', targetMuscle: 'Chest', category: 'Push', isCustom: false, isArchived: false },
      { name: 'Beta Push', targetMuscle: 'Chest', category: 'Push', isCustom: false, isArchived: false },
      { name: 'Gamma Pull', targetMuscle: 'Back', category: 'Pull', isCustom: false, isArchived: false },
      { name: 'Delta Legs', targetMuscle: 'Quads', category: 'Legs', isCustom: false, isArchived: false },
      { name: 'Epsilon Legs', targetMuscle: 'Hamstrings', category: 'Legs', isCustom: false, isArchived: false },
    ]);
  });

  it('GET returns paginated slice and total', async () => {
    const url = new URL('http://localhost/api/exercises?limit=2&offset=0');
    const res = await getExercises({
      request: new Request(url),
      url,
    } as Parameters<typeof getExercises>[0]);

    expect(res.status).toBe(200);
    const body = await readJson<{
      exercises: Array<{ name: string }>;
      total: number;
      limit: number;
      offset: number;
    }>(res);
    expect(body.exercises).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it('GET filters by category', async () => {
    const url = new URL('http://localhost/api/exercises?category=Legs&limit=10');
    const res = await getExercises({
      request: new Request(url),
      url,
    } as Parameters<typeof getExercises>[0]);

    const body = await readJson<{ exercises: Array<{ category: string }>; total: number }>(res);
    expect(body.total).toBe(2);
    expect(body.exercises.every((e) => e.category === 'Legs')).toBe(true);
  });

  it('POST rejects invalid image URL', async () => {
    const res = await postExercise({
      request: jsonRequest('POST', {
        name:          'Custom Curl',
        target_muscle: 'Biceps',
        category:      'Pull',
        image_url:     'not-a-url',
      }),
    } as Parameters<typeof postExercise>[0]);

    expect(res.status).toBe(400);
    const body = await readJson<{ error: string }>(res);
    expect(body.error).toBeTruthy();
  });

  it('POST creates custom exercise', async () => {
    const res = await postExercise({
      request: jsonRequest('POST', {
        name:          'Custom Curl',
        target_muscle: 'Biceps',
        category:      'Pull',
      }),
    } as Parameters<typeof postExercise>[0]);

    expect(res.status).toBe(201);
    const body = await readJson<{ exercise: { name: string; isCustom: boolean } }>(res);
    expect(body.exercise.name).toBe('Custom Curl');
    expect(body.exercise.isCustom).toBe(true);
  });
});
