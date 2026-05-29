import { describe, expect, it } from 'vitest';
import { isHighRiskMedExercise, needsWarmupSet, suggestedWarmupWeight } from './workoutSafety';

describe('workoutSafety', () => {
  it('flags compound lifts for warmup', () => {
    expect(needsWarmupSet('Barbell Back Squat')).toBe(true);
    expect(needsWarmupSet('Banded Face Pull')).toBe(false);
  });

  it('suggests half working weight rounded to 2.5 kg', () => {
    expect(suggestedWarmupWeight(100, false)).toBe(50);
    expect(suggestedWarmupWeight(0, false)).toBeNull();
  });

  it('marks MED high-risk patterns', () => {
    expect(isHighRiskMedExercise('Romanian Deadlift')).toBe(true);
    expect(isHighRiskMedExercise('Lat Pulldown')).toBe(false);
  });
});
