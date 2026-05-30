/** Shared meal macro estimation from AI JSON. */

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
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 3) return null;
  if (trimmed.length > 500) return null;
  return trimmed;
}

export function buildMealEstimatePrompt(description: string, mealLabel?: string): string {
  const mealCtx = mealLabel ? `Meal: ${mealLabel}.` : '';
  return `${mealCtx} The user describes what they ate (Romanian or English). Estimate total macros for the full description.

Rules:
- Use typical portion sizes when amounts are vague (e.g. "2 ouă" ≈ 140g, "o felie pâine" ≈ 30g).
- Round calories to integer; protein/carbs/fat to whole grams.
- Return ONLY JSON: {"calories": number, "protein": number, "carbs": number, "fat": number}

User input:
${description}`;
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
