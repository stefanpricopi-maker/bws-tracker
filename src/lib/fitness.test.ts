import { describe, it, expect } from 'vitest';
import {
  clamp,
  avg,
  calcBWSScore,
  autoRegulate,
  rollingAverage,
  classifyDay,
  calcStreak,
  calcEatBack,
  selectCoachRule,
  roundTo2_5,
  calcDeloadWeight,
  detectDeload,
  calcForecast,
} from './fitness';

// ── clamp ─────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it('clamps to min', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
  });
  it('clamps to max', () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
  });
  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

// ── avg ───────────────────────────────────────────────────────────────────────

describe('avg', () => {
  it('computes average of non-null values', () => {
    expect(avg([10, 20, 30])).toBeCloseTo(20);
  });
  it('ignores null values', () => {
    expect(avg([10, null, 30])).toBeCloseTo(20);
  });
  it('returns 0 for empty array', () => {
    expect(avg([])).toBe(0);
  });
  it('returns 0 when all values are null', () => {
    expect(avg([null, null])).toBe(0);
  });
});

// ── calcBWSScore ──────────────────────────────────────────────────────────────

describe('calcBWSScore', () => {
  const defaults = {
    targetCalories: 1850,
    targetProtein: 180,
    targetSteps: 10_000,
  };

  it('returns 100 for a perfect week', () => {
    // weightDelta7d = 0 → clamp(1 - 0/0.5, 0, 1) * 25 = 25 (max weight score)
    const { bwsScore } = calcBWSScore({
      ...defaults,
      weightDelta7d:  0,
      avgCalories7d:  1850,
      avgProtein7d:   180,
      avgSteps7d:     10_000,
      workoutsLast7d: 4,
    });
    expect(bwsScore).toBe(100);
  });

  it('returns 0 for empty data', () => {
    const { bwsScore } = calcBWSScore({
      ...defaults,
      weightDelta7d:  null,
      avgCalories7d:  0,
      avgProtein7d:   0,
      avgSteps7d:     0,
      workoutsLast7d: 0,
    });
    expect(bwsScore).toBe(25); // weight progress = 25 (no delta = no penalty)
  });

  it('penalises large weight gain', () => {
    const { weightProgress } = calcBWSScore({
      ...defaults,
      weightDelta7d:  1.5,  // gained 1.5 kg → abs > 0.5
      avgCalories7d:  0,
      avgProtein7d:   0,
      avgSteps7d:     0,
      workoutsLast7d: 0,
    });
    expect(weightProgress).toBe(0);
  });

  it('caps nutritionScore at 25 even when over-eating', () => {
    const { nutritionScore } = calcBWSScore({
      ...defaults,
      weightDelta7d:  null,
      avgCalories7d:  9999,
      avgProtein7d:   0,
      avgSteps7d:     0,
      workoutsLast7d: 0,
    });
    expect(nutritionScore).toBe(25);
  });

  it('caps activityScore at 25 with 5 workouts', () => {
    const { activityScore } = calcBWSScore({
      ...defaults,
      weightDelta7d:  null,
      avgCalories7d:  0,
      avgProtein7d:   0,
      avgSteps7d:     50_000,
      workoutsLast7d: 10,
    });
    expect(activityScore).toBe(25);
  });

  it('splits activity score 50/50 between steps and workouts', () => {
    const stepsOnly = calcBWSScore({
      ...defaults,
      weightDelta7d: null, avgCalories7d: 0, avgProtein7d: 0,
      avgSteps7d: 10_000, workoutsLast7d: 0,
    });
    const workoutsOnly = calcBWSScore({
      ...defaults,
      weightDelta7d: null, avgCalories7d: 0, avgProtein7d: 0,
      avgSteps7d: 0, workoutsLast7d: 4,
    });
    expect(stepsOnly.activityScore).toBe(workoutsOnly.activityScore);
    expect(stepsOnly.activityScore).toBe(13); // 12.5 rounded
  });
});

// ── autoRegulate ─────────────────────────────────────────────────────────────

describe('autoRegulate', () => {
  it('returns nulls when no previous data', () => {
    const r = autoRegulate(null, null);
    expect(r.targetWeight).toBeNull();
    expect(r.targetReps).toBeNull();
    expect(r.isWeightIncrease).toBe(false);
  });

  it('returns nulls when only one value is null', () => {
    expect(autoRegulate(80, null).targetWeight).toBeNull();
    expect(autoRegulate(null, 8).targetWeight).toBeNull();
  });

  it('Rule A: maxReps >= 10 → +2.5 kg, 8 reps', () => {
    const r = autoRegulate(80, 10);
    expect(r.targetWeight).toBe(82.5);
    expect(r.targetReps).toBe(8);
    expect(r.isWeightIncrease).toBe(true);
  });

  it('Rule A: handles floating-point weight correctly', () => {
    const r = autoRegulate(77.5, 12);
    expect(r.targetWeight).toBe(80);
  });

  it('Rule B: maxReps < 10 → same weight, reps + 1', () => {
    const r = autoRegulate(80, 8);
    expect(r.targetWeight).toBe(80);
    expect(r.targetReps).toBe(9);
    expect(r.isWeightIncrease).toBe(false);
  });

  it('Rule B: boundary at 9 reps → stays at same weight', () => {
    const r = autoRegulate(100, 9);
    expect(r.targetWeight).toBe(100);
    expect(r.targetReps).toBe(10);
    expect(r.isWeightIncrease).toBe(false);
  });

  it('Rule A: isolation uses +1 kg not +2.5 kg', () => {
    const r = autoRegulate(12, 10, 'Dumbbell Biceps Curl');
    expect(r.targetWeight).toBe(13);
    expect(r.isWeightIncrease).toBe(true);
  });

  it('Rule A: compound still uses +2.5 kg', () => {
    const r = autoRegulate(40, 10, 'Dumbbell Floor Press');
    expect(r.targetWeight).toBe(42.5);
  });
});

// ── rollingAverage ────────────────────────────────────────────────────────────

describe('rollingAverage', () => {
  const makeEntries = (weights: number[]) =>
    weights.map((weight, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, weight }));

  it('returns null avg for first 6 entries (window=7)', () => {
    const entries = makeEntries([70, 71, 72, 73, 74, 75, 76]);
    const result  = rollingAverage(entries);
    expect(result[0].avg).toBeNull();
    expect(result[5].avg).toBeNull();
    expect(result[6].avg).not.toBeNull();
  });

  it('calculates correct average for 7 identical values', () => {
    const entries = makeEntries([70, 70, 70, 70, 70, 70, 70]);
    const result  = rollingAverage(entries);
    expect(result[6].avg).toBe(70);
  });

  it('rounds to 2 decimal places', () => {
    const entries = makeEntries([70, 71, 72, 73, 74, 75, 76]);
    const result  = rollingAverage(entries);
    expect(result[6].avg).toBe(73); // (70+71+72+73+74+75+76)/7 = 73
  });

  it('custom window size', () => {
    const entries = makeEntries([10, 20, 30]);
    const result  = rollingAverage(entries, 3);
    expect(result[0].avg).toBeNull();
    expect(result[1].avg).toBeNull();
    expect(result[2].avg).toBe(20); // (10+20+30)/3
  });

  it('returns empty array for empty input', () => {
    expect(rollingAverage([])).toEqual([]);
  });
});

// ── classifyDay ───────────────────────────────────────────────────────────────

describe('classifyDay', () => {
  it('ideal: calories in range AND steps >= 10k', () => {
    expect(classifyDay({ date: '2024-01-01', calories: 1500, steps: 10_000 })).toBe('ideal');
    expect(classifyDay({ date: '2024-01-01', calories: 1200, steps: 12_000 })).toBe('ideal');
    expect(classifyDay({ date: '2024-01-01', calories: 1850, steps: 10_000 })).toBe('ideal');
  });

  it('active: steps >= 10k but calories outside range', () => {
    expect(classifyDay({ date: '2024-01-01', calories: null,  steps: 11_000 })).toBe('active');
    expect(classifyDay({ date: '2024-01-01', calories: 500,   steps: 10_001 })).toBe('active');
  });

  it('surplus: calories > 1850', () => {
    expect(classifyDay({ date: '2024-01-01', calories: 1851, steps: 0      })).toBe('surplus');
    expect(classifyDay({ date: '2024-01-01', calories: 2500, steps: null   })).toBe('surplus');
  });

  it('empty: no data or missed both targets', () => {
    expect(classifyDay({ date: '2024-01-01', calories: null, steps: null   })).toBe('empty');
    expect(classifyDay({ date: '2024-01-01', calories: 500,  steps: 5_000  })).toBe('empty');
    expect(classifyDay({ date: '2024-01-01', calories: 0,    steps: 9_999  })).toBe('empty');
  });

  it('surplus takes precedence over empty steps', () => {
    expect(classifyDay({ date: '2024-01-01', calories: 2000, steps: 500 })).toBe('surplus');
  });
});

// ── calcStreak ────────────────────────────────────────────────────────────────

describe('calcStreak', () => {
  it('returns 0 for empty array', () => {
    expect(calcStreak([])).toBe(0);
  });

  it('counts consecutive ideal/active days from the end', () => {
    const days = [
      { status: 'empty'   as const },
      { status: 'ideal'   as const },
      { status: 'active'  as const },
      { status: 'ideal'   as const },
    ];
    expect(calcStreak(days)).toBe(3);
  });

  it('breaks on surplus day', () => {
    const days = [
      { status: 'ideal'   as const },
      { status: 'surplus' as const },
      { status: 'ideal'   as const },
    ];
    expect(calcStreak(days)).toBe(1);
  });

  it('returns 0 when last day is empty', () => {
    const days = [
      { status: 'ideal'  as const },
      { status: 'empty'  as const },
    ];
    expect(calcStreak(days)).toBe(0);
  });
});

// ── calcEatBack ───────────────────────────────────────────────────────────────

describe('calcEatBack', () => {
  it('50% eat-back for moderate burn', () => {
    const r = calcEatBack(700, 1850);
    expect(r.eatBack).toBe(350);
    expect(r.adjustedTarget).toBe(2200);
    expect(r.isHigh).toBe(true);
  });

  it('caps eat-back at 500 kcal', () => {
    const r = calcEatBack(1200, 1850);
    expect(r.eatBack).toBe(500);
    expect(r.adjustedTarget).toBe(2350);
  });

  it('isHigh is false below 600 kcal burn', () => {
    expect(calcEatBack(599, 1850).isHigh).toBe(false);
    expect(calcEatBack(600, 1850).isHigh).toBe(true);
  });

  it('rounds eat-back to nearest integer', () => {
    const r = calcEatBack(701, 1850); // 701 * 0.5 = 350.5 → 351
    expect(r.eatBack).toBe(351);
  });
});

// ── selectCoachRule ───────────────────────────────────────────────────────────

describe('selectCoachRule', () => {
  it('Rule 4: insufficient data (< 3 days logged)', () => {
    expect(selectCoachRule({ weightDelta7d: -0.5, avgSteps7d: 12_000, daysWithCalories: 2 })).toBe(4);
  });

  it('Rule 1: weight loss 0.5–0.8 kg → maintain calories', () => {
    expect(selectCoachRule({ weightDelta7d: -0.5, avgSteps7d: 8_000, daysWithCalories: 7 })).toBe(1);
    expect(selectCoachRule({ weightDelta7d: -0.8, avgSteps7d: 8_000, daysWithCalories: 7 })).toBe(1);
  });

  it('Rule 2: loss < 0.2 kg AND low steps → increase steps', () => {
    expect(selectCoachRule({ weightDelta7d: -0.1, avgSteps7d: 8_000, daysWithCalories: 5 })).toBe(2);
    expect(selectCoachRule({ weightDelta7d:  0.1, avgSteps7d: 9_999, daysWithCalories: 5 })).toBe(2);
  });

  it('Rule 1 fallback: loss < 0.2 but steps are fine', () => {
    expect(selectCoachRule({ weightDelta7d: -0.1, avgSteps7d: 11_000, daysWithCalories: 5 })).toBe(1);
  });
});

// ── roundTo2_5 ────────────────────────────────────────────────────────────────

describe('roundTo2_5', () => {
  it('rounds 80 → 80 (already on boundary)', () => expect(roundTo2_5(80)).toBe(80));
  it('rounds 81 → 80 (below midpoint)', ()    => expect(roundTo2_5(81)).toBe(80));
  it('rounds 81.3 → 82.5 (above midpoint)',   () => expect(roundTo2_5(81.3)).toBe(82.5));
  it('rounds 83.75 → 85',                      () => expect(roundTo2_5(83.75)).toBe(85));
  it('rounds 0 → 0',                           () => expect(roundTo2_5(0)).toBe(0));
  it('handles decimal input correctly',        () => expect(roundTo2_5(77.5)).toBe(77.5));
});

// ── calcDeloadWeight ──────────────────────────────────────────────────────────

describe('calcDeloadWeight', () => {
  it('80 kg → 70 kg (~12.5% deload)', () => expect(calcDeloadWeight(80)).toBe(70));
  it('100 kg → 87.5 kg', () => expect(calcDeloadWeight(100)).toBe(87.5));
  it('banded: Heavy → Medium', () => expect(calcDeloadWeight(3, true)).toBe(2));
});

// ── detectDeload ──────────────────────────────────────────────────────────────

describe('detectDeload', () => {
  it('returns false when fewer than 3 sessions', () => {
    expect(detectDeload([])).toBe(false);
    expect(detectDeload([{ maxWeight: 80, maxReps: 8 }])).toBe(false);
    expect(detectDeload([{ maxWeight: 80, maxReps: 8 }, { maxWeight: 80, maxReps: 8 }])).toBe(false);
  });

  it('ignores sessions older than 56-day lookback', () => {
    const old = { maxWeight: 80, maxReps: 8, date: '2020-01-01' };
    expect(detectDeload([old, old, old])).toBe(false);
  });

  it('returns true when weight and reps are perfectly stagnant over 3 sessions', () => {
    const s = { maxWeight: 80, maxReps: 8 };
    expect(detectDeload([s, s, s])).toBe(true);
  });

  it('returns true when weight decreases monotonically', () => {
    expect(detectDeload([
      { maxWeight: 85, maxReps: 8 },
      { maxWeight: 82, maxReps: 8 },
      { maxWeight: 80, maxReps: 8 },
    ])).toBe(true);
  });

  it('returns true when reps decrease monotonically at same weight', () => {
    expect(detectDeload([
      { maxWeight: 80, maxReps: 9 },
      { maxWeight: 80, maxReps: 8 },
      { maxWeight: 80, maxReps: 7 },
    ])).toBe(true);
  });

  it('returns false when weight increases between any sessions', () => {
    expect(detectDeload([
      { maxWeight: 80, maxReps: 8 },
      { maxWeight: 82, maxReps: 8 }, // increased
      { maxWeight: 82, maxReps: 8 },
    ])).toBe(false);
  });

  it('returns false when reps increase between any sessions', () => {
    expect(detectDeload([
      { maxWeight: 80, maxReps: 7 },
      { maxWeight: 80, maxReps: 8 }, // reps increased
      { maxWeight: 80, maxReps: 8 },
    ])).toBe(false);
  });

  it('returns false when only weight stagnates but reps improve', () => {
    expect(detectDeload([
      { maxWeight: 80, maxReps: 7 },
      { maxWeight: 80, maxReps: 8 },
      { maxWeight: 80, maxReps: 9 },
    ])).toBe(false);
  });

  it('returns false when only reps stagnate but weight improves', () => {
    expect(detectDeload([
      { maxWeight: 80, maxReps: 8 },
      { maxWeight: 82, maxReps: 8 },
      { maxWeight: 85, maxReps: 8 },
    ])).toBe(false);
  });
});

// ── calcForecast ──────────────────────────────────────────────────────────────

describe('calcForecast', () => {
  const today = new Date('2026-05-28T12:00:00Z');
  const goalKg = 83.6;

  function makeWeights(first: number, last: number, count = 14): (number | null)[] {
    // Linear interpolation from first to last over 14 days
    return Array.from({ length: count }, (_, i) =>
      +(first + (last - first) * (i / (count - 1))).toFixed(1));
  }

  it('detects stagnant when no weight change', () => {
    const weights = Array(14).fill(90);
    const result = calcForecast({ weights, goalKg, today });
    expect(result.isStagnant).toBe(true);
    expect(result.weeklyRateKg).toBeCloseTo(0, 1);
  });

  it('detects stagnant when gaining weight', () => {
    const weights = makeWeights(88, 90);
    const result = calcForecast({ weights, goalKg, today });
    expect(result.isStagnant).toBe(true);
  });

  it('projects a date when losing consistently', () => {
    // Losing ~0.5 kg/week: 90 → 89 over 14 days
    const weights = makeWeights(90, 89);
    const result = calcForecast({ weights, goalKg, today });
    expect(result.isStagnant).toBe(false);
    expect(result.weeklyRateKg).toBeLessThan(-0.1);
    expect(result.daysRemaining).toBeGreaterThan(0);
    expect(result.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns alreadyAtGoal when current avg <= goal', () => {
    const weights = Array(14).fill(83.0);
    const result = calcForecast({ weights, goalKg, today });
    expect(result.alreadyAtGoal).toBe(true);
    expect(result.isStagnant).toBe(false);
  });

  it('returns insufficientData when fewer than 4 non-null values', () => {
    const weights = [90, null, null, null, null, null, null, null, null, null, null, null, null, null];
    const result = calcForecast({ weights, goalKg, today });
    expect(result.insufficientData).toBe(true);
  });

  it('ignores null slots in average calculation', () => {
    // Mix of nulls and values, still enough data
    const weights: (number | null)[] = [90, null, 90, null, 90, null, 89.5, 89.5, 89, null, 89, null, 89, null];
    const result = calcForecast({ weights, goalKg, today });
    expect(result.insufficientData).toBe(false);
    expect(result.currentAvgKg).toBeLessThan(90);
  });
});
