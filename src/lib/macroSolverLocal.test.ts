import { describe, it, expect } from 'vitest';
import { generateMealPlanFromCatalog } from './macroSolverLocal';

const ALLOWED = [
  'oats', 'milk_whole', 'eggs', 'chicken_breast', 'rice_white', 'broccoli',
  'banana', 'peanut_butter', 'greek_yogurt', 'turkey', 'pasta', 'spinach',
  'apple', 'bread_whole', 'tomato', 'salmon', 'rice_brown', 'walnuts',
];

describe('macroSolverLocal', () => {
  it('builds a recipe-based 4-meal plan', () => {
    const targets = { calories: 1850, protein: 180, carbs: 113, fat: 75 };
    const plan = generateMealPlanFromCatalog(targets, ALLOWED);

    expect(plan.meals).toHaveLength(4);
    expect(plan.meals.map((m) => m.meal_name)).toEqual(['Mic dejun', 'Prânz', 'Gustări', 'Cină']);

    for (const meal of plan.meals) {
      expect(meal.recipe_name.length).toBeGreaterThan(5);
      expect(meal.recipe_name.split(' ').length).toBeGreaterThan(2);
      expect(meal.ingredients.length).toBeGreaterThan(0);
      expect(meal.total_calories).toBeGreaterThan(100);
    }

    expect(plan.daily_totals.calories).toBeGreaterThan(1200);
    expect(plan.daily_totals.calories).toBeLessThan(2800);
    expect(Math.abs(plan.daily_totals.protein - targets.protein)).toBeLessThan(70);
  });

  it('uses snack recipes not olive oil alone', () => {
    const plan = generateMealPlanFromCatalog(
      { calories: 1850, protein: 180, carbs: 113, fat: 75 },
      ALLOWED,
    );
    const snacks = plan.meals.find((m) => m.meal_name === 'Gustări')!;
    expect(snacks.recipe_name.toLowerCase()).toMatch(/măr|banană|iaurt|bară|humus/);
  });
});
