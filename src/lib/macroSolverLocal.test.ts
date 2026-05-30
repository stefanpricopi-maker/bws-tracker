import { describe, it, expect } from 'vitest';
import { generateMealPlanFromCatalog } from './macroSolverLocal';

describe('macroSolverLocal', () => {
  it('builds a 4-meal plan from allowed catalog foods', () => {
    const plan = generateMealPlanFromCatalog(
      { calories: 1850, protein: 180, carbs: 113, fat: 75 },
      ['oats', 'milk_whole', 'eggs', 'chicken_breast', 'rice_white', 'broccoli', 'banana', 'peanut_butter'],
    );

    expect(plan.meals).toHaveLength(4);
    expect(plan.meals.map((m) => m.meal_name)).toEqual(['Mic dejun', 'Prânz', 'Gustări', 'Cină']);
    expect(plan.daily_totals.calories).toBeGreaterThan(800);
    for (const meal of plan.meals) {
      expect(meal.ingredients.length).toBeGreaterThan(0);
      expect(meal.total_calories).toBeGreaterThan(0);
    }
  });
});
