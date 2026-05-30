import { describe, it, expect } from 'vitest';
import { normalizeWeeklyPlan, WEEKLY_SCHEDULE } from './weeklyPlan';

const validNames = new Set(['Dumbbell Floor Press', 'Dumbbell Bent-Over Row']);

describe('normalizeWeeklyPlan', () => {
  it('expands a 5-day LLM plan into 7 calendar days with Wed/Sun rest', () => {
    const plan = normalizeWeeklyPlan(
      {
        days: [
          { day_name: 'Monday', category: 'Push', exercises: [{ name: 'Dumbbell Floor Press', sets: 4 }] },
          { day_name: 'Tuesday', category: 'Pull', exercises: [{ name: 'Dumbbell Bent-Over Row', sets: 3 }] },
          { day_name: 'Thursday', category: 'Legs', exercises: [{ name: 'Dumbbell Floor Press', sets: 3 }] },
          { day_name: 'Friday', category: 'Upper', exercises: [{ name: 'Dumbbell Floor Press', sets: 3 }] },
          { day_name: 'Saturday', category: 'Legs+Arms', exercises: [{ name: 'Dumbbell Bent-Over Row', sets: 2 }] },
        ],
      },
      validNames,
      false,
    );

    expect(plan.split_type).toBe('7-day');
    expect(plan.days).toHaveLength(7);
    expect(plan.days.map((d) => d.day_name)).toEqual(WEEKLY_SCHEDULE.map((d) => d.day_name));
    expect(plan.days[2]).toEqual({ day_name: 'Wednesday', category: 'Rest', exercises: [] });
    expect(plan.days[6]).toEqual({ day_name: 'Sunday', category: 'Rest', exercises: [] });
    expect(plan.days[0].exercises).toHaveLength(1);
  });

  it('strips hallucinated exercises', () => {
    const plan = normalizeWeeklyPlan(
      {
        days: [
          {
            day_name: 'Monday',
            category: 'Push',
            exercises: [
              { name: 'Dumbbell Floor Press', sets: 4 },
              { name: 'Fake Press', sets: 3 },
            ],
          },
        ],
      },
      validNames,
      false,
    );

    expect(plan.days[0].exercises.map((e) => e.name)).toEqual(['Dumbbell Floor Press']);
  });
});
