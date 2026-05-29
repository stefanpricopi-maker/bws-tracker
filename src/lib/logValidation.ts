/** Server-side validation for daily log upserts. */

import {
  MEAL_SLOTS,
  type MealMacros,
  type StoredDayMeals,
  sumDayMeals,
} from './mealIntake';

export interface ValidatedLogPatch {
  weightKg?:    number;
  steps?:       number;
  caloriesIn?:  number;
  proteinG?:    number;
  carbsG?:      number;
  fatG?:        number;
  mealsJson?:   string;
}

function parseOptionalNumber(
  v: unknown,
  label: string,
  min: number,
  max: number,
): number | undefined | string {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return n;
}

function parseMealMacros(v: unknown, label: string): MealMacros | string {
  if (v == null) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  if (typeof v !== 'object') return `${label} must be an object.`;

  const row = v as Record<string, unknown>;
  const calories = parseOptionalNumber(row.calories, `${label}.calories`, 0, 10_000);
  if (typeof calories === 'string') return calories;
  const protein = parseOptionalNumber(row.protein, `${label}.protein`, 0, 500);
  if (typeof protein === 'string') return protein;
  const carbs = parseOptionalNumber(row.carbs, `${label}.carbs`, 0, 1000);
  if (typeof carbs === 'string') return carbs;
  const fat = parseOptionalNumber(row.fat, `${label}.fat`, 0, 500);
  if (typeof fat === 'string') return fat;

  return {
    calories: Math.round(calories ?? 0),
    protein:  Math.round((protein ?? 0) * 10) / 10,
    carbs:    Math.round((carbs ?? 0) * 10) / 10,
    fat:      Math.round((fat ?? 0) * 10) / 10,
  };
}

function parseMealsBody(body: Record<string, unknown>): StoredDayMeals | string {
  const raw = body.meals;
  if (raw == null || typeof raw !== 'object') return 'meals must be an object.';

  const stored = {} as StoredDayMeals;
  for (const slot of MEAL_SLOTS) {
    const parsed = parseMealMacros((raw as Record<string, unknown>)[slot], slot);
    if (typeof parsed === 'string') return parsed;
    stored[slot] = parsed;
  }
  return stored;
}

function applyMealTotals(patch: ValidatedLogPatch, totals: MealMacros) {
  patch.caloriesIn = totals.calories > 0 ? totals.calories : undefined;
  patch.proteinG   = totals.protein  > 0 ? totals.protein  : undefined;
  patch.carbsG     = totals.carbs    > 0 ? totals.carbs    : undefined;
  patch.fatG       = totals.fat      > 0 ? totals.fat      : undefined;
}

export function validateLogPatch(
  body: Record<string, unknown>,
): { ok: true; patch: ValidatedLogPatch } | { ok: false; error: string } {
  const patch: ValidatedLogPatch = {};

  const weight = parseOptionalNumber(body.weight_kg, 'weight_kg', 30, 300);
  if (typeof weight === 'string') return { ok: false, error: weight };
  if (weight !== undefined) patch.weightKg = Math.round(weight * 10) / 10;

  const steps = parseOptionalNumber(body.steps, 'steps', 0, 100_000);
  if (typeof steps === 'string') return { ok: false, error: steps };
  if (steps !== undefined) patch.steps = Math.round(steps);

  const calories = parseOptionalNumber(body.calories_in, 'calories_in', 0, 10_000);
  if (typeof calories === 'string') return { ok: false, error: calories };
  if (calories !== undefined) patch.caloriesIn = Math.round(calories);

  const protein = parseOptionalNumber(body.protein_g, 'protein_g', 0, 500);
  if (typeof protein === 'string') return { ok: false, error: protein };
  if (protein !== undefined) patch.proteinG = Math.round(protein);

  const carbs = parseOptionalNumber(body.carbs_g, 'carbs_g', 0, 1000);
  if (typeof carbs === 'string') return { ok: false, error: carbs };
  if (carbs !== undefined) patch.carbsG = Math.round(carbs);

  const fat = parseOptionalNumber(body.fat_g, 'fat_g', 0, 500);
  if (typeof fat === 'string') return { ok: false, error: fat };
  if (fat !== undefined) patch.fatG = Math.round(fat);

  if (body.meals != null) {
    const meals = parseMealsBody(body);
    if (typeof meals === 'string') return { ok: false, error: meals };
    patch.mealsJson = JSON.stringify(meals);
    applyMealTotals(patch, sumDayMeals(meals));
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'At least one log field is required.' };
  }

  return { ok: true, patch };
}
