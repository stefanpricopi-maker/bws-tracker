/** Server-side validation for daily log upserts. */

export interface ValidatedLogPatch {
  weightKg?:    number;
  steps?:       number;
  caloriesIn?:  number;
  proteinG?:    number;
  carbsG?:      number;
  fatG?:        number;
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

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'At least one log field is required.' };
  }

  return { ok: true, patch };
}
