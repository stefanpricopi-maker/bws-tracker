import { describe, it, expect } from 'vitest';
import { generateMealPlanFromCatalog } from './macroSolverLocal';

const ALLOWED = [
  'oats', 'milk_whole', 'eggs', 'chicken_breast', 'rice_white', 'broccoli',
  'banana', 'peanut_butter', 'protein_bar', 'greek_yogurt', 'turkey', 'pasta',
];

describe('macroSolverLocal', () => {
  it('builds a 4-meal plan from allowed catalog foods', () => {
    const targets = { calories: 1850, protein: 180, carbs: 113, fat: 75 };
    const plan = generateMealPlanFromCatalog(targets, ALLOWED);

    expect(plan.meals).toHaveLength(4);
    expect(plan.meals.map((m) => m.meal_name)).toEqual(['Mic dejun', 'Prânz', 'Gustări', 'Cină']);
    expect(plan.daily_totals.calories).toBeGreaterThan(targets.calories * 0.85);
    expect(plan.daily_totals.calories).toBeLessThan(targets.calories * 1.2);

    for (const meal of plan.meals) {
      expect(meal.ingredients.length).toBeGreaterThan(0);
      for (const ing of meal.ingredients) {
        expect(ing.amount_g).toBeLessThanOrEqual(350);
        if (ing.item.toLowerCase().includes('bară proteică') || ing.item.includes('protein')) {
          expect(ing.amount_g).toBeLessThanOrEqual(65);
        }
      }
    }
  });

  it('does not turn one snack into a 500g protein bar', () => {
    const plan = generateMealPlanFromCatalog(
      { calories: 1850, protein: 180, carbs: 113, fat: 75 },
      ['protein_bar', 'peanut_butter', 'chicken_breast', 'rice_white', 'broccoli', 'banana'],
    );
    const snackBar = plan.meals
      .find((m) => m.meal_name === 'Gustări')
      ?.ingredients.find((i) => i.item.toLowerCase().includes('bară'));
    if (snackBar) {
      expect(snackBar.amount_g).toBeLessThanOrEqual(65);
      expect(snackBar.calories).toBeLessThan(300);
    }
  });
});
