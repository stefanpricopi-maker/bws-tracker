import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestDb, resetApiTestDb, readJson } from './api-harness';
import { GET as getWeeklyPlan } from '../../src/pages/api/generate-weekly-plan';
import { exercises } from '../../src/db/schema';

const mockChatCompletion = vi.fn();

vi.mock('../../src/lib/aiApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/aiApi')>();
  return {
    ...actual,
    getAiConfig: () => ({
      baseUrl: 'http://test.local/v1',
      apiKey:  'test-key',
      model:   'test-model',
    }),
    chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  };
});

describe('GET /api/generate-weekly-plan', () => {
  beforeEach(async () => {
    await resetApiTestDb();
    mockChatCompletion.mockReset();
    await getTestDb().db.insert(exercises).values([
      { name: 'Dumbbell Floor Press', targetMuscle: 'Chest', category: 'Push', isCustom: false, isArchived: false },
      { name: 'Dumbbell Bent-Over Row', targetMuscle: 'Back', category: 'Pull', isCustom: false, isArchived: false },
    ]);
  });

  it('strips hallucinated exercises from LLM plan', async () => {
    mockChatCompletion.mockResolvedValue(JSON.stringify({
      split_type: '7-day',
      days: [
        {
          day_name: 'Monday',
          category: 'Push',
          exercises: [
            { name: 'Dumbbell Floor Press', sets: 4 },
            { name: 'Fake Machine Press', sets: 3 },
          ],
        },
      ],
    }));

    const res = await getWeeklyPlan({
      request: new Request('http://localhost/api/generate-weekly-plan'),
    } as Parameters<typeof getWeeklyPlan>[0]);

    expect(res.status).toBe(200);
    const body = await readJson<{
      plan: { split_type: string; days: Array<{ day_name: string; category: string; exercises: Array<{ name: string }> }> };
    }>(res);
    expect(body.plan.split_type).toBe('7-day');
    expect(body.plan.days).toHaveLength(7);
    expect(body.plan.days[2]).toMatchObject({ day_name: 'Wednesday', category: 'Rest', exercises: [] });
    expect(body.plan.days[6]).toMatchObject({ day_name: 'Sunday', category: 'Rest', exercises: [] });
    const names = body.plan.days[0].exercises.map((e) => e.name);
    expect(names).toEqual(['Dumbbell Floor Press']);
    expect(mockChatCompletion).toHaveBeenCalledOnce();
  });

  it('returns 422 when library is empty', async () => {
    await getTestDb().client.execute('DELETE FROM exercises');

    const res = await getWeeklyPlan({
      request: new Request('http://localhost/api/generate-weekly-plan'),
    } as Parameters<typeof getWeeklyPlan>[0]);

    expect(res.status).toBe(422);
    const body = await readJson<{ error: string; code: string }>(res);
    expect(body.code).toBe('ai_validation');
  });
});
