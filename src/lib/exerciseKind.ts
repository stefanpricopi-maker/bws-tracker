/** Classify home-gym exercises for load type, rest, and validation. */

export function isBandedExercise(exerciseName: string): boolean {
  const n = exerciseName.toLowerCase();
  return n.includes('banded') || n.includes(' band ') || n.startsWith('band ') || n.endsWith(' band');
}

export const BAND_LEVEL_LABELS: Record<number, string> = {
  1: 'Light',
  2: 'Medium',
  3: 'Heavy',
};

export function formatBandLevel(weight: number): string {
  return BAND_LEVEL_LABELS[Math.round(weight)] ?? `Level ${weight}`;
}

/** Human-readable load: band level (Light/Medium/Heavy) or kg for dumbbells. */
export function formatExerciseLoad(weight: number, exerciseName: string): string {
  return isBandedExercise(exerciseName) ? formatBandLevel(weight) : `${weight} kg`;
}

export function isValidBandLevel(weight: number): boolean {
  return Number.isInteger(weight) && weight >= 1 && weight <= 3;
}
