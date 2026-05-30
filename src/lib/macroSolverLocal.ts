/**
 * Deterministic meal plan from the curated food catalog (no LLM).
 */

import type { FoodCategory } from './foodCatalog';
import {
  getFoodNutrition,
  gramsFromAmount,
  type FoodAmountUnit,
  type FoodNutritionEntry,
} from './foodNutrition';
import { MEAL_LABELS, MEAL_SLOTS, type MealMacros, type MealSlot } from './mealIntake';

export interface MealPlanIngredient {
  item:      string;
  amount_g:  number;
  protein:   number;
  carbs:     number;
  fat:       number;
  calories:  number;
}

export interface MealPlanMeal {
  meal_name:      string;
  ingredients:    MealPlanIngredient[];
  total_calories: number;
}

export interface MealPlan {
  meals:        MealPlanMeal[];
  daily_totals: MealMacros;
}

interface TemplateLine {
  category: FoodCategory;
  amount:   number;
  unit:     FoodAmountUnit;
}

const MEAL_CAL_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch:     0.35,
  snacks:    0.10,
  dinner:    0.30,
};

const MEAL_TEMPLATES: Record<MealSlot, TemplateLine[]> = {
  breakfast: [
    { category: 'carbs',    amount: 80,  unit: 'g' },
    { category: 'dairy',    amount: 200, unit: 'ml' },
    { category: 'protein',  amount: 2,   unit: 'buc' },
  ],
  lunch: [
    { category: 'protein',    amount: 150, unit: 'g' },
    { category: 'carbs',      amount: 150, unit: 'g' },
    { category: 'vegetables', amount: 120, unit: 'g' },
  ],
  snacks: [
    { category: 'snacks', amount: 1, unit: 'buc' },
    { category: 'fats',   amount: 15, unit: 'g' },
  ],
  dinner: [
    { category: 'protein',    amount: 150, unit: 'g' },
    { category: 'carbs',      amount: 100, unit: 'g' },
    { category: 'vegetables', amount: 120, unit: 'g' },
  ],
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pickFood(
  pool: FoodNutritionEntry[],
  category: FoodCategory,
  used: Set<string>,
): FoodNutritionEntry | null {
  const inCat = pool.filter((f) => f.category === category);
  const fresh = inCat.find((f) => !used.has(f.id));
  if (fresh) return fresh;
  return inCat[0] ?? null;
}

function ingredientFromLine(
  food: FoodNutritionEntry,
  amount: number,
  unit: FoodAmountUnit,
): MealPlanIngredient {
  const grams = gramsFromAmount(food, amount, unit);
  const factor = grams / 100;
  return {
    item:     food.label,
    amount_g: Math.round(grams),
    protein:  round1(food.per100.protein * factor),
    carbs:    round1(food.per100.carbs * factor),
    fat:      round1(food.per100.fat * factor),
    calories: Math.round(food.per100.calories * factor),
  };
}

function sumIngredients(items: MealPlanIngredient[]): MealMacros {
  return items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein:  acc.protein  + i.protein,
      carbs:    acc.carbs    + i.carbs,
      fat:      acc.fat      + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function buildMeal(
  slot: MealSlot,
  pool: FoodNutritionEntry[],
  targets: MealMacros,
  used: Set<string>,
): MealPlanMeal {
  const template = MEAL_TEMPLATES[slot];
  const lines: Array<{ food: FoodNutritionEntry; amount: number; unit: FoodAmountUnit }> = [];

  for (const line of template) {
    let food = pickFood(pool, line.category, used);
    if (!food) {
      food = pool.find((f) => !used.has(f.id)) ?? pool[0] ?? null;
    }
    if (!food) continue;
    used.add(food.id);
    lines.push({ food, amount: line.amount, unit: line.unit });
  }

  if (lines.length === 0 && pool[0]) {
    lines.push({ food: pool[0], amount: 100, unit: 'g' });
  }

  let ingredients = lines.map(({ food, amount, unit }) =>
    ingredientFromLine(food, amount, unit),
  );

  const mealCalTarget = targets.calories * MEAL_CAL_SHARE[slot];
  let mealCal = sumIngredients(ingredients).calories;
  if (mealCal > 0 && mealCalTarget > 0) {
    const factor = Math.min(2.5, Math.max(0.4, mealCalTarget / mealCal));
    ingredients = lines.map(({ food, amount, unit }) =>
      ingredientFromLine(
        food,
        Math.max(5, Math.round((amount * factor) / 5) * 5),
        unit,
      ),
    );
  }

  mealCal = sumIngredients(ingredients).calories;
  return {
    meal_name:      MEAL_LABELS[slot],
    ingredients,
    total_calories: mealCal,
  };
}

export function generateMealPlanFromCatalog(
  targets: MealMacros,
  allowedIds: string[],
): MealPlan {
  const pool = allowedIds
    .map((id) => getFoodNutrition(id))
    .filter((f): f is FoodNutritionEntry => f != null);

  if (pool.length === 0) {
    throw new Error('Niciun aliment din catalog în lista ta. Selectează alimente cu valori nutritionale.');
  }

  const used = new Set<string>();
  const meals = MEAL_SLOTS.map((slot) => buildMeal(slot, pool, targets, used));

  const daily_totals = meals.reduce(
    (acc, meal) => {
      const m = sumIngredients(meal.ingredients);
      return {
        calories: acc.calories + m.calories,
        protein:  acc.protein  + m.protein,
        carbs:    acc.carbs    + m.carbs,
        fat:      acc.fat      + m.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    meals,
    daily_totals: {
      calories: Math.round(daily_totals.calories),
      protein:  round1(daily_totals.protein),
      carbs:    round1(daily_totals.carbs),
      fat:      round1(daily_totals.fat),
    },
  };
}
