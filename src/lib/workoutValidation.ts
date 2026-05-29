/** Shared server-side validation for workout set payloads. */

export interface ValidatedSet {
  exerciseName: string;
  weight:       number;
  reps:         number;
  setNumber:    number;
}

const MAX_WEIGHT_KG = 500;
const MAX_REPS      = 100;
const MAX_SET_NUM   = 50;

function parsePositiveInt(v: unknown, label: string, max: number): number | string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    return `${label} must be an integer between 1 and ${max}.`;
  }
  return n;
}

function parseWeight(v: unknown): number | string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_WEIGHT_KG) {
    return `weight must be between 0 and ${MAX_WEIGHT_KG} kg.`;
  }
  return Math.round(n * 100) / 100;
}

export function validateSetPayload(body: {
  exercise_name?: unknown;
  weight?:         unknown;
  reps?:           unknown;
  set_number?:     unknown;
}): { ok: true; data: ValidatedSet } | { ok: false; error: string } {
  const exerciseName = typeof body.exercise_name === 'string' ? body.exercise_name.trim() : '';
  if (!exerciseName || exerciseName.length > 120) {
    return { ok: false, error: 'exercise_name is required (max 120 characters).' };
  }

  const weight = parseWeight(body.weight);
  if (typeof weight === 'string') return { ok: false, error: weight };

  const reps = parsePositiveInt(body.reps, 'reps', MAX_REPS);
  if (typeof reps === 'string') return { ok: false, error: reps };

  const setNumber = parsePositiveInt(body.set_number, 'set_number', MAX_SET_NUM);
  if (typeof setNumber === 'string') return { ok: false, error: setNumber };

  return {
    ok: true,
    data: { exerciseName, weight, reps, setNumber },
  };
}

export function validateBulkSetRow(s: unknown): ValidatedSet | null {
  if (typeof s !== 'object' || s === null) return null;
  const row = s as Record<string, unknown>;
  const result = validateSetPayload({
    exercise_name: row.exerciseName ?? row.exercise_name,
    weight:        row.weight,
    reps:          row.reps,
    set_number:    row.setNumber ?? row.set_number,
  });
  return result.ok ? {
    exerciseName: result.data.exerciseName,
    weight:       result.data.weight,
    reps:         result.data.reps,
    setNumber:    result.data.setNumber,
  } : null;
}
