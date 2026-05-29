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
      lunch:     { calories: '500', protein: '35', carbs: '45', fat: '12' },
      snacks:    { calories: '350', protein: '15', carbs: '30', fat: '12' },
      dinner:    { calories: '450', protein: '35', carbs: '40', fat: '10' },
    });
    expect(sumDayMeals(stored)).toEqual({
      calories: 1700,
      protein: 115,
      carbs: 155,
      fat: 44,
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
    expect(mealSlotFromPlanName('Gustări')).toBe('snacks');
    expect(mealSlotFromPlanName('Snacks')).toBe('snacks');
    expect(mealSlotFromPlanName('Dinner')).toBe('dinner');
  });
});
