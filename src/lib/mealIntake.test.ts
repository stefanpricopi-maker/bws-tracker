import { describe, it, expect } from 'vitest';
import {
  sumDayMeals,
  storedMealsFromForm,
  parseStoredDayMeals,
  dayMealsFormFromDailyTotals,
  mealSlotFromPlanName,
  EMPTY_DAY_MEALS,
} from './mealIntake';

describe('mealIntake', () => {
  it('sums meals for daily totals', () => {
    const stored = storedMealsFromForm({
      ...EMPTY_DAY_MEALS,
      breakfast: { calories: '400', protein: '30', carbs: '40', fat: '10' },
      lunch:     { calories: '600', protein: '40', carbs: '50', fat: '15' },
      dinner:    { calories: '500', protein: '35', carbs: '45', fat: '12' },
    });
    expect(sumDayMeals(stored)).toEqual({
      calories: 1500,
      protein: 105,
      carbs: 135,
      fat: 37,
    });
  });

  it('parses stored meals JSON shape', () => {
    const parsed = parseStoredDayMeals({
      breakfast: { calories: 400, protein: 30, carbs: 40, fat: 10 },
      lunch:     { calories: 0, protein: 0, carbs: 0, fat: 0 },
      dinner:    { calories: 0, protein: 0, carbs: 0, fat: 0 },
    });
    expect(parsed?.breakfast.calories).toBe(400);
  });

  it('legacy totals map to breakfast only', () => {
    const form = dayMealsFormFromDailyTotals({ calories: 1800, protein: 150, carbs: 100, fat: 50 });
    expect(form.breakfast.calories).toBe('1800');
    expect(form.lunch.calories).toBe('');
  });

  it('maps AI meal names to slots', () => {
    expect(mealSlotFromPlanName('Breakfast')).toBe('breakfast');
    expect(mealSlotFromPlanName('Prânz')).toBe('lunch');
    expect(mealSlotFromPlanName('Dinner')).toBe('dinner');
  });
});
