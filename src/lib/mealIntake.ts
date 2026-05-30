/** Per-meal macro logging (breakfast → lunch → snacks → dinner). */

export const MEAL_SLOTS = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export interface MealMacros {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

export type StoredDayMeals = Record<MealSlot, MealMacros>;

export interface MealFormFields {
  calories: string;
  protein:  string;
  carbs:    string;
  fat:      string;
}

export type DayMealsForm = Record<MealSlot, MealFormFields>;

export const EMPTY_MEAL_FORM: MealFormFields = {
  calories: '',
  protein:  '',
  carbs:    '',
  fat:      '',
};

const ZERO_MACROS: MealMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function emptyStoredMeals(): StoredDayMeals {
  return Object.fromEntries(MEAL_SLOTS.map((s) => [s, { ...ZERO_MACROS }])) as StoredDayMeals;
}

export const EMPTY_DAY_MEALS: DayMealsForm = Object.fromEntries(
  MEAL_SLOTS.map((s) => [s, { ...EMPTY_MEAL_FORM }]),
) as DayMealsForm;

export const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Mic dejun',
  lunch:     'Prânz',
  snacks:    'Gustări',
  dinner:    'Cină',
};

export function formatMacroGrams(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function macrosFromForm(f: MealFormFields): MealMacros {
  return {
    calories: Math.round(Number(f.calories) || 0),
    protein:  Math.round((Number(f.protein) || 0) * 10) / 10,
    carbs:    Math.round((Number(f.carbs) || 0) * 10) / 10,
    fat:      Math.round((Number(f.fat) || 0) * 10) / 10,
  };
}

export function sumDayMeals(meals: StoredDayMeals): MealMacros {
  return MEAL_SLOTS.reduce(
    (acc, slot) => ({
      calories: acc.calories + meals[slot].calories,
      protein:  acc.protein  + meals[slot].protein,
      carbs:    acc.carbs    + meals[slot].carbs,
      fat:      acc.fat      + meals[slot].fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function storedMealsFromForm(form: DayMealsForm): StoredDayMeals {
  return Object.fromEntries(
    MEAL_SLOTS.map((slot) => [slot, macrosFromForm(form[slot])]),
  ) as StoredDayMeals;
}

export function dayMealsFormFromStored(stored: StoredDayMeals): DayMealsForm {
  const toFields = (m: MealMacros): MealFormFields => ({
    calories: m.calories > 0 ? String(m.calories) : '',
    protein:  m.protein  > 0 ? String(m.protein)  : '',
    carbs:    m.carbs    > 0 ? String(m.carbs)    : '',
    fat:      m.fat      > 0 ? String(m.fat)      : '',
  });
  return Object.fromEntries(
    MEAL_SLOTS.map((slot) => [slot, toFields(stored[slot])]),
  ) as DayMealsForm;
}

/** Legacy row: no per-meal JSON — show totals under breakfast. */
export function dayMealsFormFromDailyTotals(totals: MealMacros): DayMealsForm {
  const form = { ...EMPTY_DAY_MEALS };
  if (totals.calories > 0 || totals.protein > 0 || totals.carbs > 0 || totals.fat > 0) {
    form.breakfast = {
      calories: totals.calories > 0 ? String(totals.calories) : '',
      protein:  totals.protein  > 0 ? String(totals.protein)  : '',
      carbs:    totals.carbs    > 0 ? String(totals.carbs)    : '',
      fat:      totals.fat      > 0 ? String(totals.fat)      : '',
    };
  }
  return form;
}

export function parseStoredDayMeals(raw: unknown): StoredDayMeals | null {
  if (raw == null || typeof raw !== 'object') return null;
  const out = emptyStoredMeals();
  for (const slot of MEAL_SLOTS) {
    const m = (raw as Record<string, unknown>)[slot];
    if (m == null || typeof m !== 'object') continue;
    const row = m as Record<string, unknown>;
    out[slot] = {
      calories: Math.round(Number(row.calories) || 0),
      protein:  Math.round((Number(row.protein) || 0) * 10) / 10,
      carbs:    Math.round((Number(row.carbs) || 0) * 10) / 10,
      fat:      Math.round((Number(row.fat) || 0) * 10) / 10,
    };
  }
  const total = sumDayMeals(out);
  if (total.calories === 0 && total.protein === 0 && total.carbs === 0 && total.fat === 0) {
    return null;
  }
  return out;
}

export function mealSlotFromPlanName(name: string): MealSlot {
  const n = name.toLowerCase();
  if (n.includes('breakfast') || n.includes('mic dejun') || n.includes('micul')) return 'breakfast';
  if (n.includes('lunch') || n.includes('prânz') || n.includes('pranz')) return 'lunch';
  if (n.includes('snack') || n.includes('gustar') || n.includes('gustări')) return 'snacks';
  if (n.includes('dinner') || n.includes('cină') || n.includes('cina')) return 'dinner';
  return 'dinner';
}
