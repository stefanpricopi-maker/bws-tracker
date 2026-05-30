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

interface ResolvedLine {
  food:   FoodNutritionEntry;
  amount: number;
  unit:   FoodAmountUnit;
}

/** Realistic base portions before any scaling. */
const MEAL_TEMPLATES: Record<MealSlot, TemplateLine[]> = {
  breakfast: [
    { category: 'carbs',   amount: 60,  unit: 'g' },
    { category: 'dairy',   amount: 200, unit: 'ml' },
    { category: 'protein', amount: 120, unit: 'g' },
  ],
  lunch: [
    { category: 'protein',    amount: 170, unit: 'g' },
    { category: 'carbs',      amount: 140, unit: 'g' },
    { category: 'vegetables', amount: 150, unit: 'g' },
  ],
  snacks: [
    { category: 'snacks', amount: 1, unit: 'buc' },
    { category: 'fats',   amount: 12, unit: 'g' },
  ],
  dinner: [
    { category: 'protein',    amount: 170, unit: 'g' },
    { category: 'carbs',      amount: 100, unit: 'g' },
    { category: 'vegetables', amount: 150, unit: 'g' },
  ],
};

const FOOD_MAX_GRAMS: Partial<Record<string, number>> = {
  protein_bar: 65,
  peanut_butter: 32,
  olive_oil:     20,
};

const CATEGORY_MAX_GRAMS: Record<FoodCategory, number> = {
  protein:    220,
  carbs:      250,
  dairy:      300,
  vegetables: 350,
  fats:       35,
  snacks:     180,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function maxGramsFor(food: FoodNutritionEntry): number {
  return FOOD_MAX_GRAMS[food.id] ?? CATEGORY_MAX_GRAMS[food.category] ?? 300;
}

function pickFood(
  pool: FoodNutritionEntry[],
  category: FoodCategory,
  used: Set<string>,
): FoodNutritionEntry | null {
  let candidates = pool.filter((f) => f.category === category && !used.has(f.id));
  if (candidates.length === 0) {
    candidates = pool.filter((f) => f.category === category);
  }
  if (candidates.length === 0) return null;

  if (category === 'snacks') {
    candidates = [...candidates].sort((a, b) => {
      if (a.id === 'protein_bar') return 1;
      if (b.id === 'protein_bar') return -1;
      return a.per100.calories - b.per100.calories;
    });
  }

  return candidates[0] ?? null;
}

function clampAmount(
  food: FoodNutritionEntry,
  amount: number,
  unit: FoodAmountUnit,
): number {
  if (unit === 'buc') {
    const pieces = Math.min(2, Math.max(1, Math.round(amount)));
    const grams = gramsFromAmount(food, pieces, 'buc');
    if (grams <= maxGramsFor(food)) return pieces;
    const unitG = food.pieceGrams ?? 100;
    return Math.max(1, Math.floor(maxGramsFor(food) / unitG));
  }
  if (unit === 'lingura') {
    return Math.min(2, Math.max(1, Math.round(amount)));
  }
  const capped = Math.min(maxGramsFor(food), Math.max(10, Math.round(amount / 5) * 5));
  return capped;
}

function ingredientFromLine(
  food: FoodNutritionEntry,
  amount: number,
  unit: FoodAmountUnit,
): MealPlanIngredient {
  const safeAmount = clampAmount(food, amount, unit);
  const grams = gramsFromAmount(food, safeAmount, unit);
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

function resolveMealLines(
  slot: MealSlot,
  pool: FoodNutritionEntry[],
  used: Set<string>,
): ResolvedLine[] {
  const lines: ResolvedLine[] = [];

  for (const line of MEAL_TEMPLATES[slot]) {
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

  return lines;
}

function buildMealFromLines(
  slot: MealSlot,
  lines: ResolvedLine[],
  scale: number,
): MealPlanMeal {
  const ingredients = lines.map(({ food, amount, unit }) =>
    ingredientFromLine(food, amount * scale, unit),
  );
  const totals = sumIngredients(ingredients);
  return {
    meal_name:      MEAL_LABELS[slot],
    ingredients,
    total_calories: totals.calories,
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
  const lineSets = MEAL_SLOTS.map((slot) => resolveMealLines(slot, pool, used));

  const baseMeals = MEAL_SLOTS.map((slot, i) =>
    buildMealFromLines(slot, lineSets[i], 1),
  );
  const baseTotals = baseMeals.reduce(
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

  let scale = 1;
  if (baseTotals.calories > 0 && targets.calories > 0) {
    scale = targets.calories / baseTotals.calories;
    scale = Math.min(1.15, Math.max(0.85, scale));
  }

  const meals = MEAL_SLOTS.map((slot, i) =>
    buildMealFromLines(slot, lineSets[i], scale),
  );

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

/** Guard for tests/UI — no single ingredient should exceed these. */
export function isRealisticPortion(foodId: string, amountG: number): boolean {
  const food = getFoodNutrition(foodId);
  if (!food) return amountG <= 350;
  return amountG <= maxGramsFor(food);
}
