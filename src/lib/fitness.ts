// ─────────────────────────────────────────────────────────────────────────────
// Pure math functions — no DB, no framework dependencies.
// Used by API routes and React components; tested independently via Vitest.
// ─────────────────────────────────────────────────────────────────────────────

import { isBandedExercise } from './exerciseKind';
import { isIsolationExercise } from './restDuration';

// ── Primitives ────────────────────────────────────────────────────────────────

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function avg(vals: (number | null)[]): number {
  const nonNull = vals.filter((v): v is number => v != null);
  if (nonNull.length === 0) return 0;
  return nonNull.reduce((a, b) => a + b, 0) / nonNull.length;
}

// ── BWS Score ─────────────────────────────────────────────────────────────────

export interface BWSInputs {
  weightDelta7d:   number | null;  // kg lost this week (negative = gain)
  avgCalories7d:   number;
  avgProtein7d:    number;
  avgSteps7d:      number;
  workoutsLast7d:  number;
  targetCalories:  number;
  targetProtein:   number;
  targetSteps:     number;
}

export interface BWSBreakdown {
  weightProgress: number;
  nutritionScore: number;
  proteinScore:   number;
  activityScore:  number;
  bwsScore:       number;
}

export function calcBWSScore(inputs: BWSInputs): BWSBreakdown {
  const weightProgress = Math.round(
    clamp(1 - Math.abs(inputs.weightDelta7d ?? 0) / 0.5, 0, 1) * 25,
  );
  const nutritionScore = Math.round(
    clamp(inputs.avgCalories7d / inputs.targetCalories, 0, 1) * 25,
  );
  const proteinScore = Math.round(
    clamp(inputs.avgProtein7d / inputs.targetProtein, 0, 1) * 25,
  );
  const activityScore = Math.round(
    clamp(inputs.avgSteps7d / inputs.targetSteps, 0, 1) * 12.5 +
    clamp(inputs.workoutsLast7d / 4, 0, 1) * 12.5,
  );
  const bwsScore = Math.round(weightProgress + nutritionScore + proteinScore + activityScore);
  return { weightProgress, nutritionScore, proteinScore, activityScore, bwsScore };
}

// ── CNS Deload Detection ──────────────────────────────────────────────────────

export interface SessionBest {
  maxWeight: number;
  maxReps:   number;
}

/**
 * Rounds a weight to the nearest 2.5 kg increment (standard barbell plate math).
 * e.g. 81 → 80, 81.3 → 82.5, 0 → 0
 */
export function roundTo2_5(weight: number): number {
  return Math.round(weight / 2.5) * 2.5;
}

/** ~12.5% load reduction (between 10–15% BWS deload range). */
export const DELOAD_LOAD_FACTOR = 0.875;

/** Only sessions within this window count toward CNS stagnation. */
export const CNS_LOOKBACK_DAYS = 56;

export interface SessionBestWithDate extends SessionBest {
  date?: string;
}

/**
 * Returns the deload weight: ~12.5% off max, rounded to nearest 2.5 kg (dumbbells).
 */
export function calcDeloadWeight(maxWeight: number, banded = false): number {
  if (banded) {
    return Math.max(1, Math.round(maxWeight) - 1);
  }
  return roundTo2_5(maxWeight * DELOAD_LOAD_FACTOR);
}

/** Keep only sessions from the last `maxDays` (default 56). */
export function filterRecentSessions<T extends { date?: string }>(
  sessions: T[],
  maxDays = CNS_LOOKBACK_DAYS,
): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sessions.filter((s) => !s.date || s.date >= cutoffStr);
}

/**
 * Detects CNS fatigue / stagnation across the last 3 sessions (ordered oldest → newest).
 *
 * Triggers deload when BOTH weight AND reps never improved across consecutive sessions:
 *   session[1].maxWeight <= session[0].maxWeight  (no progress in pair 0→1)
 *   session[2].maxWeight <= session[1].maxWeight  (no progress in pair 1→2)
 *   AND same for reps.
 *
 * Requires exactly 3 sessions to make a meaningful judgement.
 */
export function detectDeload(sessions: SessionBest[], maxDays = CNS_LOOKBACK_DAYS): boolean {
  const recent = filterRecentSessions(
    sessions.map((s, i) => ({ ...s, date: (s as SessionBestWithDate).date })),
    maxDays,
  );
  if (recent.length < 3) return false;
  const [s0, s1, s2] = recent.slice(-3); // oldest → newest of last 3 recent
  const weightStagnant = s1.maxWeight <= s0.maxWeight && s2.maxWeight <= s1.maxWeight;
  const repsStagnant   = s1.maxReps   <= s0.maxReps   && s2.maxReps   <= s1.maxReps;
  return weightStagnant && repsStagnant;
}

// ── Auto-regulation (Progressive Overload) ────────────────────────────────────

export interface AutoRegulateResult {
  targetWeight:    number | null;
  targetReps:      number | null;
  isWeightIncrease: boolean;
}

/** Weight jump when Rule A applies: +1 kg isolation, +2.5 kg compound. */
export function weightIncrementKg(exerciseName?: string): number {
  return exerciseName && isIsolationExercise(exerciseName) ? 1 : 2.5;
}

export function autoRegulate(
  maxWeight: number | null,
  maxReps:   number | null,
  exerciseName?: string,
): AutoRegulateResult {
  if (maxWeight === null || maxReps === null) {
    return { targetWeight: null, targetReps: null, isWeightIncrease: false };
  }
  if (exerciseName && isBandedExercise(exerciseName)) {
    const level = Math.round(maxWeight);
    if (maxReps >= 10 && level < 3) {
      return { targetWeight: level + 1, targetReps: 8, isWeightIncrease: true };
    }
    return {
      targetWeight: level,
      targetReps:   maxReps + 1,
      isWeightIncrease: false,
    };
  }
  if (maxReps >= 10) {
    const inc = weightIncrementKg(exerciseName);
    return {
      targetWeight:     Math.round((maxWeight + inc) * 100) / 100,
      targetReps:       8,
      isWeightIncrease: true,
    };
  }
  // Rule B: accumulate reps at same weight
  return {
    targetWeight:     maxWeight,
    targetReps:       maxReps + 1,
    isWeightIncrease: false,
  };
}

// ── Rolling Average ───────────────────────────────────────────────────────────

export interface DayEntry {
  date:   string;
  weight: number;
}

export interface ChartPoint {
  date: string;
  avg:  number | null;
}

export function rollingAverage(entries: DayEntry[], window = 7): ChartPoint[] {
  return entries.map((entry, i) => {
    if (i < window - 1) return { date: entry.date, avg: null };
    const slice = entries.slice(i - window + 1, i + 1);
    const mean  = slice.reduce((s, e) => s + e.weight, 0) / window;
    return { date: entry.date, avg: Math.round(mean * 100) / 100 };
  });
}

// ── Consistency Heatmap ───────────────────────────────────────────────────────

export const CAL_MIN  = 1200;
export const CAL_MAX  = 1850;
export const STEP_MIN = 10_000;

export interface HeatmapThresholds {
  calMin:  number;
  calMax:  number;
  stepMin: number;
}

/** ±15% relative to the user's target deficit % (see SPECS heatmap). */
export const HEATMAP_DEFICIT_TOLERANCE_PCT = 15;

export interface HeatmapDeficitBands {
  targetDeficitPct: number;
  minDeficitPct:    number;
  maxDeficitPct:    number;
}

/** % of TDEE not eaten (positive = below maintenance, negative = surplus). */
export function deficitPercentOfTdee(tdeeKcal: number, eatenKcal: number): number {
  if (tdeeKcal <= 0) return 0;
  return ((tdeeKcal - eatenKcal) / tdeeKcal) * 100;
}

/** Human-readable deficit vs TDEE for heatmap tooltips. */
export function formatDeficitPercentLabel(deficitPct: number): string {
  const n = Math.round(deficitPct * 10) / 10;
  if (n > 0) return `${n}% below TDEE`;
  if (n < 0) return `${Math.abs(n)}% above TDEE`;
  return 'at TDEE';
}

/** Intake at a given deficit % below TDEE (0% = maintenance). */
export function caloriesAtDeficitPercent(tdeeKcal: number, deficitPercent: number): number {
  return Math.round(tdeeKcal * (1 - deficitPercent / 100));
}

export function heatmapDeficitBandsFromGoals(
  goals: { tdeeKcal?: number | null; targetCaloriesKcal?: number | null } | null,
  toleranceRelativePct = HEATMAP_DEFICIT_TOLERANCE_PCT,
): HeatmapDeficitBands | null {
  const tdee = goals?.tdeeKcal;
  if (tdee == null || tdee <= 0) return null;

  const targetCal =
    goals?.targetCaloriesKcal != null && goals.targetCaloriesKcal > 0
      ? goals.targetCaloriesKcal
      : CAL_MAX;

  const targetDeficitPct = deficitPercentOfTdee(tdee, targetCal);
  const delta = (targetDeficitPct * toleranceRelativePct) / 100;

  return {
    targetDeficitPct,
    minDeficitPct: Math.max(0, targetDeficitPct - delta),
    maxDeficitPct: targetDeficitPct + delta,
  };
}

export function heatmapThresholdsFromTdeeDeficit(
  goals: {
    tdeeKcal?: number | null;
    targetCaloriesKcal?: number | null;
    targetSteps?: number | null;
  } | null,
): HeatmapThresholds {
  const bands = heatmapDeficitBandsFromGoals(goals);
  if (!bands || goals?.tdeeKcal == null || goals.tdeeKcal <= 0) {
    return heatmapThresholdsFromGoals(goals);
  }

  const stepMin =
    goals?.targetSteps != null && goals.targetSteps > 0
      ? goals.targetSteps
      : STEP_MIN;

  return {
    calMin: caloriesAtDeficitPercent(goals.tdeeKcal, bands.maxDeficitPct),
    calMax: caloriesAtDeficitPercent(goals.tdeeKcal, bands.minDeficitPct),
    stepMin,
  };
}

export function heatmapThresholdsFromGoals(
  goals: { targetCaloriesKcal?: number | null; targetSteps?: number | null } | null,
): HeatmapThresholds {
  const targetCal =
    goals?.targetCaloriesKcal != null && goals.targetCaloriesKcal > 0
      ? goals.targetCaloriesKcal
      : CAL_MAX;
  const stepMin =
    goals?.targetSteps != null && goals.targetSteps > 0
      ? goals.targetSteps
      : STEP_MIN;
  return {
    calMin: Math.max(800, targetCal - 150),
    calMax: targetCal + 100,
    stepMin,
  };
}

export type DayStatus = 'ideal' | 'active' | 'surplus' | 'empty';

export interface DayData {
  date:     string;
  calories: number | null;
  steps:    number | null;
}

export function classifyDay(d: DayData, thresholds?: HeatmapThresholds): DayStatus {
  const t = thresholds ?? { calMin: CAL_MIN, calMax: CAL_MAX, stepMin: STEP_MIN };
  const hasCalories = d.calories !== null && d.calories > 0;
  const hasSteps    = d.steps    !== null;

  const inDeficit = hasCalories && d.calories! >= t.calMin && d.calories! <= t.calMax;
  const hitSteps  = hasSteps && d.steps! >= t.stepMin;
  const surplus   = hasCalories && d.calories! > t.calMax;

  if (inDeficit && hitSteps) return 'ideal';
  if (hitSteps)              return 'active';
  if (surplus)               return 'surplus';
  return 'empty';
}

export function calcStreak(days: { status: DayStatus }[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const s = days[i].status;
    if (s === 'ideal' || s === 'active') streak++;
    else break;
  }
  return streak;
}

// ── Active Burn Eat-Back ──────────────────────────────────────────────────────

export interface EatBackResult {
  eatBack:        number;   // kcal to add above base target
  adjustedTarget: number;   // base + eatBack
  isHigh:         boolean;  // burn >= 600 kcal → show nuanced message
}

export function calcEatBack(activeBurn: number, baseTarget: number): EatBackResult {
  const eatBack        = Math.min(Math.round(activeBurn * 0.5), 500);
  const adjustedTarget = baseTarget + eatBack;
  const isHigh         = activeBurn >= 600;
  return { eatBack, adjustedTarget, isHigh };
}

// ── Goal Forecasting ──────────────────────────────────────────────────────────

export interface ForecastInput {
  /** Chronological (oldest first) weight readings, null = no log that day */
  weights: (number | null)[];
  goalKg:  number;
  today:   Date;
}

export interface ForecastResult {
  isStagnant:      boolean;
  weeklyRateKg:    number;   // kg/week, negative = losing
  currentAvgKg:    number;   // avg of last 7 days
  daysRemaining:   number | null;
  projectedDate:   string   | null;  // ISO YYYY-MM-DD
  alreadyAtGoal:   boolean;
  insufficientData: boolean;
}

/**
 * Compares average weight of the FIRST half vs LAST half of a 14-day window
 * to compute a noise-resistant rate of change.
 *
 * Stagnant when cutting toward goalKg but losing < 250 g/week (noise-tolerant) or gaining.
 */
export const FORECAST_STAGNANT_WEEKLY_KG = -0.25;

export function calcForecast(input: ForecastInput): ForecastResult {
  const { weights, goalKg, today } = input;

  const nonNull = weights.filter((w): w is number => w != null);
  if (nonNull.length < 4) {
    return { isStagnant: true, weeklyRateKg: 0, currentAvgKg: 0,
             daysRemaining: null, projectedDate: null, alreadyAtGoal: false, insufficientData: true };
  }

  const mid = Math.floor(weights.length / 2);
  const firstHalf = weights.slice(0, mid).filter((w): w is number => w != null);
  const lastHalf  = weights.slice(mid).filter((w): w is number => w != null);

  if (firstHalf.length === 0 || lastHalf.length === 0) {
    return { isStagnant: true, weeklyRateKg: 0, currentAvgKg: 0,
             daysRemaining: null, projectedDate: null, alreadyAtGoal: false, insufficientData: true };
  }

  const avgFirst = avg(firstHalf);
  const avgLast  = avg(lastHalf);

  // Daily rate (negative = losing)
  const dailyRate  = (avgLast - avgFirst) / mid;
  const weeklyRate = +(dailyRate * 7).toFixed(2);

  const currentAvgKg = +avgLast.toFixed(1);
  const alreadyAtGoal = currentAvgKg <= goalKg;

  const cutting = currentAvgKg > goalKg;
  const isStagnant = cutting && weeklyRate >= FORECAST_STAGNANT_WEEKLY_KG;

  if (alreadyAtGoal) {
    return { isStagnant: false, weeklyRateKg: weeklyRate, currentAvgKg,
             daysRemaining: 0, projectedDate: today.toISOString().slice(0, 10), alreadyAtGoal: true, insufficientData: false };
  }

  if (isStagnant) {
    return { isStagnant: true, weeklyRateKg: weeklyRate, currentAvgKg,
             daysRemaining: null, projectedDate: null, alreadyAtGoal: false, insufficientData: false };
  }

  const daysRemaining = Math.ceil((currentAvgKg - goalKg) / Math.abs(dailyRate));
  const projectedMs   = today.getTime() + daysRemaining * 86_400_000;
  const projectedDate = new Date(projectedMs).toISOString().slice(0, 10);

  return { isStagnant: false, weeklyRateKg: weeklyRate, currentAvgKg,
           daysRemaining, projectedDate, alreadyAtGoal: false, insufficientData: false };
}

// ── AI Coach Rule Selector ────────────────────────────────────────────────────

export type CoachRule = 1 | 2 | 4;

export interface CoachInputs {
  weightDelta7d:   number | null;  // kg (negative = gained)
  avgSteps7d:      number;
  daysWithCalories: number;        // out of 7
}

export function selectCoachRule(inputs: CoachInputs): CoachRule {
  if (inputs.daysWithCalories < 3) return 4;
  if (inputs.weightDelta7d !== null) {
    const loss = -inputs.weightDelta7d; // positive = lost weight
    if (loss >= 0.5 && loss <= 0.8) return 1;
    if (loss < 0.2 && inputs.avgSteps7d < 10_000) return 2;
  }
  return 1;
}
