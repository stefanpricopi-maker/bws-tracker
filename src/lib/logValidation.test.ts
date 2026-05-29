import { describe, it, expect } from 'vitest';
import { validateLogPatch } from './logValidation';

describe('validateLogPatch', () => {
  it('accepts valid fields', () => {
    const r = validateLogPatch({ weight_kg: 85.5, steps: 8000, calories_in: 1800 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.weightKg).toBe(85.5);
      expect(r.patch.steps).toBe(8000);
    }
  });

  it('rejects negative calories', () => {
    const r = validateLogPatch({ calories_in: -100 });
    expect(r.ok).toBe(false);
  });

  it('rejects zero reps-style invalid weight', () => {
    const r = validateLogPatch({ weight_kg: 10 });
    expect(r.ok).toBe(false);
  });

  it('sums meals into daily totals', () => {
    const r = validateLogPatch({
      meals: {
        breakfast: { calories: 400, protein: 30, carbs: 40, fat: 10 },
        lunch:     { calories: 600, protein: 40, carbs: 50, fat: 15 },
        dinner:    { calories: 0, protein: 0, carbs: 0, fat: 0 },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.caloriesIn).toBe(1000);
      expect(r.patch.mealsJson).toContain('breakfast');
    }
  });
});
