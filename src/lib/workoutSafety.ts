/** Exercise safety heuristics for M.E.D. and warmup suggestions. */

export function isHighRiskMedExercise(exerciseName: string): boolean {
  const n = exerciseName.toLowerCase();
  return (
    n.includes('split squat') ||
    n.includes('goblet squat') ||
    n.includes('romanian') ||
    n.includes('rdl') ||
    n.includes('deadlift')
  );
}

export function needsWarmupSet(exerciseName: string): boolean {
  const n = exerciseName.toLowerCase();
  if (n.includes('banded') || n.includes('curl') || n.includes('raise') || n.includes('fly')) {
    return false;
  }
  return (
    n.includes('squat') ||
    n.includes('press') ||
    n.includes('rdl') ||
    n.includes('deadlift') ||
    n.includes('row') && !n.includes('face')
  );
}

export function suggestedWarmupWeight(workingWeight: number, banded: boolean): number | null {
  if (banded || workingWeight <= 0) return null;
  return Math.max(2.5, Math.round((workingWeight * 0.5) / 2.5) * 2.5);
}
