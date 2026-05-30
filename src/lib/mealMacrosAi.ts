/** Shared meal macro normalization and form helpers. */

export interface MealMacrosEstimate {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

export function normalizeMealMacros(raw: {
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
}): MealMacrosEstimate {
  return {
    calories: Math.max(0, Math.round(Number(raw.calories) || 0)),
    protein:  Math.max(0, Math.round(Number(raw.protein)  || 0)),
    carbs:    Math.max(0, Math.round(Number(raw.carbs)    || 0)),
    fat:      Math.max(0, Math.round(Number(raw.fat)      || 0)),
  };
}

export function validateMealDescription(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;
  if (trimmed.length > 500) return null;
  return trimmed;
}

export function mealMacrosToFormFields(m: MealMacrosEstimate): {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
} {
  return {
    calories: m.calories > 0 ? String(m.calories) : '',
    protein:  m.protein  > 0 ? String(m.protein)  : '',
    carbs:    m.carbs    > 0 ? String(m.carbs)    : '',
    fat:      m.fat      > 0 ? String(m.fat)      : '',
  };
}
