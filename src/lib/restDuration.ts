/** Rest seconds after a working set, by exercise type (BWS home-gym heuristics). */
export function restSecondsForExercise(exerciseName: string): number {
  const n = exerciseName.toLowerCase();

  const isolation =
    n.includes('curl') ||
    n.includes('raise') && !n.includes('press') ||
    n.includes('fly') ||
    n.includes('pushdown') ||
    n.includes('skullcrusher') ||
    n.includes('face pull') ||
    n.includes('calf') ||
    n.includes('hammer') ||
    n.includes('lateral') ||
    n.includes('triceps') ||
    n.includes('biceps') ||
    n.includes('leg curl');

  if (isolation) return 60;

  const heavyCompound =
    n.includes('romanian') ||
    n.includes('rdl') ||
    n.includes('deadlift') ||
    n.includes('split squat') ||
    n.includes('goblet squat') ||
    (n.includes('press') && !n.includes('lateral'));

  if (heavyCompound) return 120;

  return 90;
}
