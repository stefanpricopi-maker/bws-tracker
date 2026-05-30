/**
 * Curated meal recipes built from catalog foods — used for daily meal plans.
 */

import {
  getFoodNutrition,
  gramsFromAmount,
  type FoodAmountUnit,
} from './foodNutrition';
import type { MealMacros, MealSlot } from './mealIntake';
import { MEAL_SLOTS } from './mealIntake';

export interface ResolvedRecipeIngredient {
  item:      string;
  food_id:   string;
  amount:    number;
  unit:      FoodAmountUnit;
  amount_g:  number;
  protein:   number;
  carbs:     number;
  fat:       number;
  calories:  number;
}

export interface RecipeLine {
  foodId: string;
  amount: number;
  unit:   FoodAmountUnit;
}

export interface MealRecipeDef {
  id:    string;
  name:  string;
  slot:  MealSlot;
  lines: RecipeLine[];
}

export const MEAL_RECIPES: MealRecipeDef[] = [
  // ── Mic dejun ─────────────────────────────────────────────────────────────
  {
    id: 'breakfast_oats_bowl',
    name: 'Bol de ovăz cu lapte și banană',
    slot: 'breakfast',
    lines: [
      { foodId: 'oats', amount: 60, unit: 'g' },
      { foodId: 'milk_whole', amount: 200, unit: 'ml' },
      { foodId: 'banana', amount: 1, unit: 'buc' },
    ],
  },
  {
    id: 'breakfast_eggs_toast',
    name: 'Ouă omletă cu pâine integrală',
    slot: 'breakfast',
    lines: [
      { foodId: 'eggs', amount: 2, unit: 'buc' },
      { foodId: 'bread_whole', amount: 40, unit: 'g' },
      { foodId: 'tomato', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'breakfast_yogurt_oats',
    name: 'Iaurt grecesc cu ovăz și fructe de pădure',
    slot: 'breakfast',
    lines: [
      { foodId: 'greek_yogurt', amount: 200, unit: 'g' },
      { foodId: 'oats', amount: 40, unit: 'g' },
      { foodId: 'berries', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'breakfast_oats_pb',
    name: 'Ovăz cu lapte și unt de arahide',
    slot: 'breakfast',
    lines: [
      { foodId: 'oats', amount: 50, unit: 'g' },
      { foodId: 'milk_whole', amount: 200, unit: 'ml' },
      { foodId: 'peanut_butter', amount: 1, unit: 'lingura' },
    ],
  },
  {
    id: 'breakfast_cottage_toast',
    name: 'Pâine integrală cu brânză cottage și fructe',
    slot: 'breakfast',
    lines: [
      { foodId: 'bread_whole', amount: 50, unit: 'g' },
      { foodId: 'cottage_cheese', amount: 150, unit: 'g' },
      { foodId: 'berries', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'breakfast_avocado_eggs',
    name: 'Ouă cu avocado și pâine integrală',
    slot: 'breakfast',
    lines: [
      { foodId: 'eggs', amount: 2, unit: 'buc' },
      { foodId: 'avocado', amount: 0.5, unit: 'buc' },
      { foodId: 'bread_whole', amount: 40, unit: 'g' },
    ],
  },
  {
    id: 'breakfast_protein_shake',
    name: 'Shake proteic cu lapte și banană',
    slot: 'breakfast',
    lines: [
      { foodId: 'whey', amount: 30, unit: 'g' },
      { foodId: 'milk_whole', amount: 250, unit: 'ml' },
      { foodId: 'banana', amount: 1, unit: 'buc' },
    ],
  },
  {
    id: 'breakfast_tortilla_eggs',
    name: 'Omletă în lipie cu ardei',
    slot: 'breakfast',
    lines: [
      { foodId: 'eggs', amount: 2, unit: 'buc' },
      { foodId: 'tortilla', amount: 45, unit: 'g' },
      { foodId: 'pepper', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'breakfast_rice_cakes',
    name: 'Vafe de orez cu unt de arahide și banană',
    slot: 'breakfast',
    lines: [
      { foodId: 'rice_cakes', amount: 30, unit: 'g' },
      { foodId: 'peanut_butter', amount: 1, unit: 'lingura' },
      { foodId: 'banana', amount: 1, unit: 'buc' },
    ],
  },
  {
    id: 'breakfast_cottage_oats',
    name: 'Ovăz cu brânză cottage și măr',
    slot: 'breakfast',
    lines: [
      { foodId: 'oats', amount: 45, unit: 'g' },
      { foodId: 'cottage_cheese', amount: 120, unit: 'g' },
      { foodId: 'apple', amount: 1, unit: 'buc' },
    ],
  },
  {
    id: 'breakfast_yogurt_quinoa',
    name: 'Iaurt grecesc cu quinoa și fructe',
    slot: 'breakfast',
    lines: [
      { foodId: 'greek_yogurt', amount: 180, unit: 'g' },
      { foodId: 'quinoa', amount: 80, unit: 'g' },
      { foodId: 'berries', amount: 60, unit: 'g' },
    ],
  },
  {
    id: 'breakfast_skim_oats',
    name: 'Ovăz cu lapte degresat și banană',
    slot: 'breakfast',
    lines: [
      { foodId: 'oats', amount: 55, unit: 'g' },
      { foodId: 'milk_skim', amount: 250, unit: 'ml' },
      { foodId: 'banana', amount: 1, unit: 'buc' },
    ],
  },
  {
    id: 'breakfast_egg_whites_toast',
    name: 'Albușuri omletă cu pâine și roșii',
    slot: 'breakfast',
    lines: [
      { foodId: 'egg_whites', amount: 4, unit: 'buc' },
      { foodId: 'bread_whole', amount: 45, unit: 'g' },
      { foodId: 'tomato', amount: 100, unit: 'g' },
    ],
  },
  // ── Prânz ─────────────────────────────────────────────────────────────────
  {
    id: 'lunch_chicken_rice_broccoli',
    name: 'Piept de pui cu orez și broccoli',
    slot: 'lunch',
    lines: [
      { foodId: 'chicken_breast', amount: 170, unit: 'g' },
      { foodId: 'rice_white', amount: 140, unit: 'g' },
      { foodId: 'broccoli', amount: 150, unit: 'g' },
    ],
  },
  {
    id: 'lunch_chicken_sweet_potato',
    name: 'Pui cu cartofi dulci și salată',
    slot: 'lunch',
    lines: [
      { foodId: 'chicken_breast', amount: 160, unit: 'g' },
      { foodId: 'sweet_potato', amount: 180, unit: 'g' },
      { foodId: 'salad_mix', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'lunch_salmon_rice',
    name: 'Somon cu orez brun și broccoli',
    slot: 'lunch',
    lines: [
      { foodId: 'salmon', amount: 150, unit: 'g' },
      { foodId: 'rice_brown', amount: 130, unit: 'g' },
      { foodId: 'broccoli', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'lunch_pasta_chicken',
    name: 'Paste cu piept de pui și roșii',
    slot: 'lunch',
    lines: [
      { foodId: 'chicken_breast', amount: 150, unit: 'g' },
      { foodId: 'pasta', amount: 120, unit: 'g' },
      { foodId: 'tomato', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'lunch_turkey_rice',
    name: 'Curcan cu orez și fasole verde',
    slot: 'lunch',
    lines: [
      { foodId: 'turkey', amount: 170, unit: 'g' },
      { foodId: 'rice_white', amount: 130, unit: 'g' },
      { foodId: 'green_beans', amount: 150, unit: 'g' },
    ],
  },
  {
    id: 'lunch_tuna_rice_salad',
    name: 'Ton cu orez și salată verde',
    slot: 'lunch',
    lines: [
      { foodId: 'tuna', amount: 160, unit: 'g' },
      { foodId: 'rice_white', amount: 130, unit: 'g' },
      { foodId: 'salad_mix', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'lunch_thigh_quinoa',
    name: 'Pulpe de pui cu quinoa și dovlecel',
    slot: 'lunch',
    lines: [
      { foodId: 'chicken_thigh', amount: 170, unit: 'g' },
      { foodId: 'quinoa', amount: 120, unit: 'g' },
      { foodId: 'zucchini', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'lunch_pork_couscous',
    name: 'Porc slab cu couscous și fasole verde',
    slot: 'lunch',
    lines: [
      { foodId: 'pork_loin', amount: 160, unit: 'g' },
      { foodId: 'couscous', amount: 130, unit: 'g' },
      { foodId: 'green_beans', amount: 140, unit: 'g' },
    ],
  },
  {
    id: 'lunch_chicken_wrap',
    name: 'Wrap cu pui, salată și roșii',
    slot: 'lunch',
    lines: [
      { foodId: 'chicken_breast', amount: 140, unit: 'g' },
      { foodId: 'tortilla', amount: 45, unit: 'g' },
      { foodId: 'salad_mix', amount: 60, unit: 'g' },
      { foodId: 'tomato', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'lunch_shrimp_rice',
    name: 'Creveți cu orez și broccoli',
    slot: 'lunch',
    lines: [
      { foodId: 'shrimp', amount: 180, unit: 'g' },
      { foodId: 'rice_white', amount: 120, unit: 'g' },
      { foodId: 'broccoli', amount: 130, unit: 'g' },
    ],
  },
  {
    id: 'lunch_tuna_pasta',
    name: 'Paste cu ton și roșii cherry',
    slot: 'lunch',
    lines: [
      { foodId: 'tuna', amount: 150, unit: 'g' },
      { foodId: 'pasta', amount: 110, unit: 'g' },
      { foodId: 'tomato', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'lunch_beef_sweet_potato',
    name: 'Vită slabă cu cartofi dulci și spanac',
    slot: 'lunch',
    lines: [
      { foodId: 'beef_lean', amount: 140, unit: 'g' },
      { foodId: 'sweet_potato', amount: 170, unit: 'g' },
      { foodId: 'spinach', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'lunch_eggs_potato_salad',
    name: 'Ouă fierte cu cartofi și salată',
    slot: 'lunch',
    lines: [
      { foodId: 'eggs', amount: 3, unit: 'buc' },
      { foodId: 'potato', amount: 180, unit: 'g' },
      { foodId: 'salad_mix', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'lunch_cod_quinoa',
    name: 'Cod cu quinoa și legume',
    slot: 'lunch',
    lines: [
      { foodId: 'cod', amount: 180, unit: 'g' },
      { foodId: 'quinoa', amount: 110, unit: 'g' },
      { foodId: 'mushrooms', amount: 100, unit: 'g' },
    ],
  },
  // ── Gustări ───────────────────────────────────────────────────────────────
  {
    id: 'snack_apple_pb',
    name: 'Măr cu unt de arahide',
    slot: 'snacks',
    lines: [
      { foodId: 'apple', amount: 1, unit: 'buc' },
      { foodId: 'peanut_butter', amount: 1, unit: 'lingura' },
    ],
  },
  {
    id: 'snack_banana_pb',
    name: 'Banană cu unt de arahide',
    slot: 'snacks',
    lines: [
      { foodId: 'banana', amount: 1, unit: 'buc' },
      { foodId: 'peanut_butter', amount: 1, unit: 'lingura' },
    ],
  },
  {
    id: 'snack_yogurt_nuts',
    name: 'Iaurt grecesc cu nuci',
    slot: 'snacks',
    lines: [
      { foodId: 'greek_yogurt', amount: 150, unit: 'g' },
      { foodId: 'walnuts', amount: 15, unit: 'g' },
    ],
  },
  {
    id: 'snack_protein_bar',
    name: 'Bară proteică',
    slot: 'snacks',
    lines: [{ foodId: 'protein_bar', amount: 60, unit: 'g' }],
  },
  {
    id: 'snack_hummus_veggies',
    name: 'Humus cu legume',
    slot: 'snacks',
    lines: [
      { foodId: 'hummus', amount: 60, unit: 'g' },
      { foodId: 'cucumber', amount: 100, unit: 'g' },
      { foodId: 'carrot', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'snack_cottage_berries',
    name: 'Brânză cottage cu fructe de pădure',
    slot: 'snacks',
    lines: [
      { foodId: 'cottage_cheese', amount: 120, unit: 'g' },
      { foodId: 'berries', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'snack_protein_shake',
    name: 'Shake proteic mic',
    slot: 'snacks',
    lines: [
      { foodId: 'whey', amount: 25, unit: 'g' },
      { foodId: 'milk_skim', amount: 200, unit: 'ml' },
    ],
  },
  {
    id: 'snack_rice_cakes_pb',
    name: 'Vafe de orez cu unt de arahide',
    slot: 'snacks',
    lines: [
      { foodId: 'rice_cakes', amount: 25, unit: 'g' },
      { foodId: 'peanut_butter', amount: 1, unit: 'lingura' },
    ],
  },
  {
    id: 'snack_apple_almonds',
    name: 'Măr cu migdale',
    slot: 'snacks',
    lines: [
      { foodId: 'apple', amount: 1, unit: 'buc' },
      { foodId: 'almonds', amount: 20, unit: 'g' },
    ],
  },
  {
    id: 'snack_avocado_rice_cakes',
    name: 'Avocado pe vafe de orez',
    slot: 'snacks',
    lines: [
      { foodId: 'avocado', amount: 0.5, unit: 'buc' },
      { foodId: 'rice_cakes', amount: 25, unit: 'g' },
    ],
  },
  {
    id: 'snack_dates_walnuts',
    name: 'Curmale cu nuci',
    slot: 'snacks',
    lines: [
      { foodId: 'dates', amount: 3, unit: 'buc' },
      { foodId: 'walnuts', amount: 15, unit: 'g' },
    ],
  },
  {
    id: 'snack_chocolate_almonds',
    name: 'Ciocolată neagră cu migdale',
    slot: 'snacks',
    lines: [
      { foodId: 'dark_chocolate', amount: 20, unit: 'g' },
      { foodId: 'almonds', amount: 15, unit: 'g' },
    ],
  },
  {
    id: 'snack_yogurt_banana',
    name: 'Iaurt grecesc cu banană',
    slot: 'snacks',
    lines: [
      { foodId: 'greek_yogurt', amount: 150, unit: 'g' },
      { foodId: 'banana', amount: 0.5, unit: 'buc' },
    ],
  },
  // ── Cină ──────────────────────────────────────────────────────────────────
  {
    id: 'dinner_turkey_pasta_spinach',
    name: 'Curcan cu paste și spanac',
    slot: 'dinner',
    lines: [
      { foodId: 'turkey', amount: 170, unit: 'g' },
      { foodId: 'pasta', amount: 100, unit: 'g' },
      { foodId: 'spinach', amount: 150, unit: 'g' },
    ],
  },
  {
    id: 'dinner_chicken_potato_salad',
    name: 'Pui cu cartofi și salată',
    slot: 'dinner',
    lines: [
      { foodId: 'chicken_breast', amount: 170, unit: 'g' },
      { foodId: 'potato', amount: 200, unit: 'g' },
      { foodId: 'salad_mix', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'dinner_cod_rice',
    name: 'Cod cu orez și dovlecel',
    slot: 'dinner',
    lines: [
      { foodId: 'cod', amount: 180, unit: 'g' },
      { foodId: 'rice_white', amount: 120, unit: 'g' },
      { foodId: 'zucchini', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'dinner_beef_rice',
    name: 'Vită slabă cu orez brun și broccoli',
    slot: 'dinner',
    lines: [
      { foodId: 'beef_lean', amount: 150, unit: 'g' },
      { foodId: 'rice_brown', amount: 120, unit: 'g' },
      { foodId: 'broccoli', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'dinner_tofu_rice',
    name: 'Tofu cu orez și legume',
    slot: 'dinner',
    lines: [
      { foodId: 'tofu', amount: 180, unit: 'g' },
      { foodId: 'rice_white', amount: 110, unit: 'g' },
      { foodId: 'pepper', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'dinner_salmon_potato',
    name: 'Somon cu cartofi și salată',
    slot: 'dinner',
    lines: [
      { foodId: 'salmon', amount: 140, unit: 'g' },
      { foodId: 'potato', amount: 180, unit: 'g' },
      { foodId: 'salad_mix', amount: 80, unit: 'g' },
    ],
  },
  {
    id: 'dinner_thigh_pasta',
    name: 'Pulpe de pui cu paste și spanac',
    slot: 'dinner',
    lines: [
      { foodId: 'chicken_thigh', amount: 160, unit: 'g' },
      { foodId: 'pasta', amount: 100, unit: 'g' },
      { foodId: 'spinach', amount: 130, unit: 'g' },
    ],
  },
  {
    id: 'dinner_pork_rice',
    name: 'Porc slab cu orez brun și fasole verde',
    slot: 'dinner',
    lines: [
      { foodId: 'pork_loin', amount: 150, unit: 'g' },
      { foodId: 'rice_brown', amount: 120, unit: 'g' },
      { foodId: 'green_beans', amount: 140, unit: 'g' },
    ],
  },
  {
    id: 'dinner_tuna_rice',
    name: 'Ton cu orez și castraveți',
    slot: 'dinner',
    lines: [
      { foodId: 'tuna', amount: 160, unit: 'g' },
      { foodId: 'rice_white', amount: 110, unit: 'g' },
      { foodId: 'cucumber', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'dinner_shrimp_quinoa',
    name: 'Creveți cu quinoa și ardei',
    slot: 'dinner',
    lines: [
      { foodId: 'shrimp', amount: 170, unit: 'g' },
      { foodId: 'quinoa', amount: 100, unit: 'g' },
      { foodId: 'pepper', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'dinner_beef_potato',
    name: 'Vită slabă cu cartofi și broccoli',
    slot: 'dinner',
    lines: [
      { foodId: 'beef_lean', amount: 140, unit: 'g' },
      { foodId: 'potato', amount: 190, unit: 'g' },
      { foodId: 'broccoli', amount: 120, unit: 'g' },
    ],
  },
  {
    id: 'dinner_eggs_spinach_toast',
    name: 'Omletă cu spanac și pâine',
    slot: 'dinner',
    lines: [
      { foodId: 'eggs', amount: 3, unit: 'buc' },
      { foodId: 'spinach', amount: 120, unit: 'g' },
      { foodId: 'bread_whole', amount: 40, unit: 'g' },
    ],
  },
  {
    id: 'dinner_chicken_quinoa',
    name: 'Piept de pui cu quinoa și ciuperci',
    slot: 'dinner',
    lines: [
      { foodId: 'chicken_breast', amount: 160, unit: 'g' },
      { foodId: 'quinoa', amount: 110, unit: 'g' },
      { foodId: 'mushrooms', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'dinner_salmon_rice',
    name: 'Somon cu orez brun și legume',
    slot: 'dinner',
    lines: [
      { foodId: 'salmon', amount: 130, unit: 'g' },
      { foodId: 'rice_brown', amount: 110, unit: 'g' },
      { foodId: 'zucchini', amount: 120, unit: 'g' },
    ],
  },
];

export const MEAL_CAL_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch:     0.35,
  snacks:    0.10,
  dinner:    0.30,
};

const PROTEIN_FOOD_IDS = new Set([
  'chicken_breast', 'chicken_thigh', 'turkey', 'beef_lean', 'pork_loin',
  'salmon', 'tuna', 'cod', 'shrimp', 'eggs', 'egg_whites', 'tofu', 'whey',
]);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function slotTargets(daily: MealMacros, slot: MealSlot): MealMacros {
  const share = MEAL_CAL_SHARE[slot];
  return {
    calories: Math.round(daily.calories * share),
    protein:  round1(daily.protein * share),
    carbs:    round1(daily.carbs * share),
    fat:      round1(daily.fat * share),
  };
}

/** Normalized weighted distance — lower is better. */
export function macroDistance(actual: MealMacros, target: MealMacros): number {
  const weights = { calories: 1.0, protein: 2.8, carbs: 1.4, fat: 2.2 };
  return (
    weights.calories * Math.abs(actual.calories - target.calories) / Math.max(target.calories, 1)
    + weights.protein  * Math.abs(actual.protein  - target.protein)  / Math.max(target.protein, 1)
    + weights.carbs    * Math.abs(actual.carbs    - target.carbs)    / Math.max(target.carbs, 1)
    + weights.fat      * Math.abs(actual.fat      - target.fat)      / Math.max(target.fat, 1)
  );
}

function primaryProteinId(recipe: MealRecipeDef): string | null {
  for (const line of recipe.lines) {
    if (PROTEIN_FOOD_IDS.has(line.foodId)) return line.foodId;
  }
  return null;
}

function varietyPenalty(recipes: MealRecipeDef[]): number {
  const proteins = recipes.map(primaryProteinId).filter((id): id is string => id != null);
  const counts = new Map<string, number>();
  for (const id of proteins) counts.set(id, (counts.get(id) ?? 0) + 1);
  let penalty = 0;
  for (const count of counts.values()) {
    if (count > 1) penalty += (count - 1) * 0.12;
  }
  return penalty;
}

export interface ScoredMealPlan {
  recipes: MealRecipeDef[];
  score:   number;
  totals:  MealMacros;
}

export function scoreMealPlanCombination(
  recipes: MealRecipeDef[],
  dailyTargets: MealMacros,
): ScoredMealPlan {
  const resolved = recipes.map((recipe) => ({
    slot: recipe.slot,
    recipe,
    ...resolveRecipe(recipe),
  }));

  const totals = resolved.reduce(
    (acc, r) => ({
      calories: acc.calories + r.totals.calories,
      protein:  acc.protein  + r.totals.protein,
      carbs:    acc.carbs    + r.totals.carbs,
      fat:      acc.fat      + r.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const dailyTotals: MealMacros = {
    calories: Math.round(totals.calories),
    protein:  round1(totals.protein),
    carbs:    round1(totals.carbs),
    fat:      round1(totals.fat),
  };

  const dailyErr = macroDistance(dailyTotals, dailyTargets);
  const slotErr = resolved.reduce(
    (acc, r) => acc + macroDistance(r.totals, slotTargets(dailyTargets, r.slot)),
    0,
  );

  const score = dailyErr + 0.35 * slotErr + varietyPenalty(recipes);

  return { recipes, score, totals: dailyTotals };
}

function candidatesForSlot(slot: MealSlot, allowed: Set<string>): MealRecipeDef[] {
  return MEAL_RECIPES.filter((r) => r.slot === slot && recipeIsAllowed(r, allowed));
}

/** Pick the best 4-recipe day plan by daily + per-meal macro fit. */
export function selectBestMealPlanRecipes(
  targets: MealMacros,
  allowedIds: string[],
): MealRecipeDef[] | null {
  const allowed = new Set(allowedIds);
  const bySlot = Object.fromEntries(
    MEAL_SLOTS.map((slot) => [slot, candidatesForSlot(slot, allowed)]),
  ) as Record<MealSlot, MealRecipeDef[]>;

  if (MEAL_SLOTS.some((slot) => bySlot[slot].length === 0)) return null;

  let best: ScoredMealPlan | null = null;

  for (const breakfast of bySlot.breakfast) {
    for (const lunch of bySlot.lunch) {
      for (const snacks of bySlot.snacks) {
        for (const dinner of bySlot.dinner) {
          const recipes = [breakfast, lunch, snacks, dinner];
          const scored = scoreMealPlanCombination(recipes, targets);
          if (!best || scored.score < best.score) best = scored;
        }
      }
    }
  }

  return best?.recipes ?? null;
}

function lineToIngredient(line: RecipeLine): ResolvedRecipeIngredient | null {
  const food = getFoodNutrition(line.foodId);
  if (!food) return null;

  const grams = gramsFromAmount(food, line.amount, line.unit);
  const factor = grams / 100;
  return {
    item:     food.label,
    food_id:  line.foodId,
    amount:   line.amount,
    unit:     line.unit,
    amount_g: Math.round(grams),
    protein:  round1(food.per100.protein * factor),
    carbs:    round1(food.per100.carbs * factor),
    fat:      round1(food.per100.fat * factor),
    calories: Math.round(food.per100.calories * factor),
  };
}

export function recipeRequiredIds(recipe: MealRecipeDef): string[] {
  return [...new Set(recipe.lines.map((l) => l.foodId))];
}

export function recipeIsAllowed(recipe: MealRecipeDef, allowedIds: Set<string>): boolean {
  return recipeRequiredIds(recipe).every((id) => allowedIds.has(id));
}

export function resolveRecipe(recipe: MealRecipeDef): {
  ingredients: ResolvedRecipeIngredient[];
  totals: MealMacros;
} {
  const ingredients = recipe.lines
    .map(lineToIngredient)
    .filter((i): i is ResolvedRecipeIngredient => i != null);

  const totals = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein:  acc.protein  + i.protein,
      carbs:    acc.carbs    + i.carbs,
      fat:      acc.fat      + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    ingredients,
    totals: {
      calories: Math.round(totals.calories),
      protein:  round1(totals.protein),
      carbs:    round1(totals.carbs),
      fat:      round1(totals.fat),
    },
  };
}

export function selectAlternateRecipeForSlot(
  slot: MealSlot,
  targets: MealMacros,
  allowedIds: string[],
  excludeRecipeIds: Set<string>,
): MealRecipeDef | null {
  const allowed = new Set(allowedIds);
  const slotTarget = slotTargets(targets, slot);

  const candidates = MEAL_RECIPES
    .filter((r) => r.slot === slot && recipeIsAllowed(r, allowed) && !excludeRecipeIds.has(r.id))
    .map((r) => ({ recipe: r, ...resolveRecipe(r) }))
    .sort((a, b) => macroDistance(a.totals, slotTarget) - macroDistance(b.totals, slotTarget));

  return candidates[0]?.recipe ?? null;
}

export function selectRecipeForSlot(
  slot: MealSlot,
  targets: MealMacros,
  allowedIds: string[],
  usedRecipeIds: Set<string>,
): MealRecipeDef | null {
  const allowed = new Set(allowedIds);
  const slotTarget = slotTargets(targets, slot);

  const candidates = MEAL_RECIPES
    .filter((r) => r.slot === slot && recipeIsAllowed(r, allowed) && !usedRecipeIds.has(r.id))
    .map((r) => ({ recipe: r, ...resolveRecipe(r) }))
    .sort((a, b) => macroDistance(a.totals, slotTarget) - macroDistance(b.totals, slotTarget));

  return candidates[0]?.recipe ?? null;
}

export function missingFoodLabelsForSlot(
  slot: MealSlot,
  allowedIds: string[],
): string[] {
  const allowed = new Set(allowedIds);
  const recipes = MEAL_RECIPES.filter((r) => r.slot === slot);
  if (recipes.length === 0) return [];

  const foodCounts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const id of recipeRequiredIds(recipe)) {
      foodCounts.set(id, (foodCounts.get(id) ?? 0) + 1);
    }
  }

  const missing: string[] = [];
  for (const [id, count] of foodCounts) {
    if (!allowed.has(id) && count >= recipes.length * 0.4) {
      const label = getFoodNutrition(id)?.label ?? id;
      missing.push(label);
    }
  }
  return missing.slice(0, 4);
}
