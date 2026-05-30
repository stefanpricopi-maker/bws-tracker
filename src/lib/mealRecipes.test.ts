import { describe, it, expect } from 'vitest';
import {
  MEAL_RECIPES,
  recipeIsAllowed,
  resolveRecipe,
  scoreMealPlanCombination,
  selectBestMealPlanRecipes,
  selectRecipeForSlot,
} from './mealRecipes';

const TARGETS = { calories: 1850, protein: 180, carbs: 113, fat: 75 };

describe('mealRecipes', () => {
  it('has a broad recipe catalog per meal slot', () => {
    expect(MEAL_RECIPES.filter((r) => r.slot === 'breakfast').length).toBeGreaterThanOrEqual(10);
    expect(MEAL_RECIPES.filter((r) => r.slot === 'lunch').length).toBeGreaterThanOrEqual(12);
    expect(MEAL_RECIPES.filter((r) => r.slot === 'snacks').length).toBeGreaterThanOrEqual(10);
    expect(MEAL_RECIPES.filter((r) => r.slot === 'dinner').length).toBeGreaterThanOrEqual(12);
  });

  it('resolves recipe macros from catalog foods', () => {
    const recipe = MEAL_RECIPES.find((r) => r.id === 'breakfast_oats_bowl')!;
    const { ingredients, totals } = resolveRecipe(recipe);
    expect(ingredients.length).toBe(3);
    expect(totals.calories).toBeGreaterThan(400);
    expect(totals.calories).toBeLessThan(650);
  });

  it('picks closest-macro recipe for a single meal slot', () => {
    const allowed = new Set([
      'oats', 'milk_whole', 'banana', 'eggs', 'bread_whole', 'tomato',
      'greek_yogurt', 'berries', 'peanut_butter', 'whey',
    ]);
    const breakfast = MEAL_RECIPES.filter((r) => r.slot === 'breakfast');
    expect(breakfast.some((r) => recipeIsAllowed(r, allowed))).toBe(true);

    const picked = selectRecipeForSlot('breakfast', TARGETS, [...allowed], new Set());
    expect(picked).not.toBeNull();
    expect(picked!.name.length).toBeGreaterThan(5);
  });

  it('global plan selection beats greedy calorie-only pairing on macro fit', () => {
    const allowed = [
      'oats', 'milk_whole', 'eggs', 'chicken_breast', 'rice_white', 'broccoli',
      'banana', 'peanut_butter', 'greek_yogurt', 'turkey', 'pasta', 'spinach',
      'apple', 'bread_whole', 'tomato', 'salmon', 'rice_brown', 'walnuts',
      'tuna', 'quinoa', 'whey', 'cottage_cheese', 'berries', 'shrimp',
    ];

    const best = selectBestMealPlanRecipes(TARGETS, allowed)!;
    expect(best).toHaveLength(4);

    const globalScore = scoreMealPlanCombination(best, TARGETS).score;

    const greedy = ['breakfast', 'lunch', 'snacks', 'dinner'].map((slot) =>
      selectRecipeForSlot(slot as 'breakfast', TARGETS, allowed, new Set())!,
    );
    const greedyScore = scoreMealPlanCombination(greedy, TARGETS).score;

    expect(globalScore).toBeLessThanOrEqual(greedyScore + 0.01);
  });

  it('optimizes full-day macro fit with fixed recipes', () => {
    const allowed = [
      'oats', 'milk_whole', 'eggs', 'chicken_breast', 'rice_white', 'broccoli',
      'greek_yogurt', 'turkey', 'pasta', 'apple', 'peanut_butter', 'whey',
      'tuna', 'quinoa', 'salmon', 'potato', 'salad_mix',
    ];
    const plan = selectBestMealPlanRecipes(TARGETS, allowed)!;
    const { totals, score } = scoreMealPlanCombination(plan, TARGETS);

    expect(plan.map((r) => r.slot)).toEqual(['breakfast', 'lunch', 'snacks', 'dinner']);
    expect(totals.calories).toBeGreaterThan(TARGETS.calories * 0.75);
    expect(totals.calories).toBeLessThan(TARGETS.calories * 1.25);
    expect(score).toBeGreaterThan(0);
  });
});
