import { proteinGramsForWeight, macrosFromCaloriesAndProtein } from './macroTargets';

export interface TdeeInput {
  weightKg:     number;
  heightCm?:    number;
  ageYears?:    number;
  sex?:         'male' | 'female';
  activityFactor?: number;
  weeklyLossKg?: number;
}

export interface TdeeResult {
  tdeeKcal:       number;
  targetCalories: number;
  targetProtein:  number;
  targetCarbs:    number;
  targetFat:      number;
}

/** `??` does not catch NaN — use this for optional numeric inputs. */
function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Mifflin–St Jeor + activity factor; targets aligned with Profile TDEE calculator. */
export function calculateTdeeFromWeight(input: TdeeInput): TdeeResult {
  const w   = input.weightKg;
  const h   = finiteOr(input.heightCm, 175);
  const a   = finiteOr(input.ageYears, 30);
  const act = finiteOr(input.activityFactor, 1.55);
  const sex = input.sex ?? 'male';
  const loss = finiteOr(input.weeklyLossKg, 0.5);

  const bmr =
    sex === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;

  const tdeeKcal = Math.round(bmr * act);
  const dailyDeficit = Math.round((loss * 7700) / 7);
  const targetCalories = Math.max(1200, tdeeKcal - dailyDeficit);
  const targetProtein  = proteinGramsForWeight(w);
  const { carbsG, fatG } = macrosFromCaloriesAndProtein(targetCalories, targetProtein);

  return {
    tdeeKcal,
    targetCalories,
    targetProtein,
    targetCarbs: carbsG,
    targetFat: fatG,
  };
}
