import { describe, it, expect } from 'vitest';
import { calculateTdeeFromWeight } from './tdee';

describe('calculateTdeeFromWeight', () => {
  it('applies 7700 kcal/kg weekly loss rule for daily deficit', () => {
    const r = calculateTdeeFromWeight({
      weightKg: 80,
      heightCm: 175,
      ageYears: 30,
      sex: 'male',
      activityFactor: 1.55,
      weeklyLossKg: 0.5,
    });
    const dailyDeficit = Math.round((0.5 * 7700) / 7);
    expect(r.targetCalories).toBe(Math.max(1200, r.tdeeKcal - dailyDeficit));
    expect(dailyDeficit).toBe(550);
  });

  it('falls back when activityFactor is NaN', () => {
    const baseline = calculateTdeeFromWeight({
      weightKg: 80,
      heightCm: 175,
      ageYears: 30,
      sex: 'male',
      activityFactor: 1.55,
      weeklyLossKg: 0.5,
    });
    const withNaN = calculateTdeeFromWeight({
      weightKg: 80,
      heightCm: 175,
      ageYears: 30,
      sex: 'male',
      activityFactor: NaN,
      weeklyLossKg: 0.5,
    });
    expect(withNaN.tdeeKcal).toBe(baseline.tdeeKcal);
    expect(Number.isFinite(withNaN.targetCalories)).toBe(true);
  });
});
