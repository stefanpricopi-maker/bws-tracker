import { describe, it, expect } from 'vitest';
import { restSecondsForExercise } from './restDuration';

describe('restSecondsForExercise', () => {
  it('uses 60s for isolation', () => {
    expect(restSecondsForExercise('Dumbbell Biceps Curl')).toBe(60);
    expect(restSecondsForExercise('Banded Lateral Raises')).toBe(60);
  });

  it('uses 120s for heavy compounds', () => {
    expect(restSecondsForExercise('Bulgarian Split Squats')).toBe(120);
    expect(restSecondsForExercise('Dumbbell Romanian Deadlifts')).toBe(120);
  });

  it('uses 90s for other compounds', () => {
    expect(restSecondsForExercise('Dumbbell Bent-Over Row')).toBe(90);
  });
});
