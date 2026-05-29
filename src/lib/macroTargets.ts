/** Body-weight-based macro targets (BWS-style). */

export const PROTEIN_G_PER_KG = 1.8;

export function proteinGramsForWeight(bodyWeightKg: number): number {
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 40) return 180;
  return Math.round(bodyWeightKg * PROTEIN_G_PER_KG);
}

/** Split remaining calories after protein: ~35% fat / rest carbs. */
export function macrosFromCaloriesAndProtein(
  calories: number,
  proteinG: number,
): { carbsG: number; fatG: number } {
  const afterProtein = Math.max(0, calories - proteinG * 4);
  const fatG   = Math.round((afterProtein * 0.35) / 9);
  const carbsG = Math.round(Math.max(0, afterProtein - fatG * 9) / 4);
  return { carbsG, fatG };
}

export interface DietTargets {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
  source:   'profile' | 'defaults';
}

export function resolveDietTargets(
  goals: {
    targetCaloriesKcal?: number | null;
    targetProteinG?:    number | null;
    targetCarbsG?:      number | null;
    targetFatG?:        number | null;
  } | null,
  bodyWeightKg: number | null,
): DietTargets {
  const weight = bodyWeightKg ?? 80;
  const protein =
    goals?.targetProteinG != null && goals.targetProteinG > 0
      ? goals.targetProteinG
      : proteinGramsForWeight(weight);

  const calories =
    goals?.targetCaloriesKcal != null && goals.targetCaloriesKcal > 0
      ? goals.targetCaloriesKcal
      : 1850;

  const carbs =
    goals?.targetCarbsG != null && goals.targetCarbsG > 0
      ? goals.targetCarbsG
      : macrosFromCaloriesAndProtein(calories, protein).carbsG;

  const fat =
    goals?.targetFatG != null && goals.targetFatG > 0
      ? goals.targetFatG
      : macrosFromCaloriesAndProtein(calories, protein).fatG;

  const hasCustom =
    goals?.targetCaloriesKcal != null ||
    goals?.targetProteinG != null;

  return {
    calories,
    protein,
    carbs,
    fat,
    source: hasCustom ? 'profile' : 'defaults',
  };
}
