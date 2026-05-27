import type { APIRoute } from 'astro';
import { db } from '../../db';
import { dailyLogs, workouts } from '../../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

const USER_ID = 1;

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

export const GET: APIRoute = () => {
  const now = new Date();

  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().slice(0, 10);

  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff7Str = cutoff7.toISOString().slice(0, 10);

  // ── Daily logs ─────────────────────────────────────────────────────────────
  const logs30 = db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), gte(dailyLogs.date, cutoff30Str)))
    .orderBy(desc(dailyLogs.date))
    .all();

  const logs7 = logs30.filter((l) => l.date >= cutoff7Str);

  // ── Weight ─────────────────────────────────────────────────────────────────
  const weightLogs30 = logs30.filter((l) => l.weightKg != null);
  const currentWeight = weightLogs30.length > 0 ? weightLogs30[0].weightKg! : null;

  // Weight 7 days ago: most recent entry that is <= cutoff7Str
  const weightLogs7ago = weightLogs30.filter((l) => l.date <= cutoff7Str);
  const weight7dAgo = weightLogs7ago.length > 0 ? weightLogs7ago[0].weightKg! : null;

  // Weight 30 days ago: most recent entry at the start of the window
  const weightLogs30ago = weightLogs30.filter((l) => l.date <= cutoff30Str);
  const weight30dAgo =
    weightLogs30ago.length > 0
      ? weightLogs30ago[0].weightKg!
      : weightLogs30.length > 0
        ? weightLogs30[weightLogs30.length - 1].weightKg!
        : null;

  const weightDelta7d =
    currentWeight != null && weight7dAgo != null
      ? parseFloat((currentWeight - weight7dAgo).toFixed(2))
      : null;

  const weightDelta30d =
    currentWeight != null && weight30dAgo != null
      ? parseFloat((currentWeight - weight30dAgo).toFixed(2))
      : null;

  // ── 7-day averages ─────────────────────────────────────────────────────────
  function avg(vals: (number | null)[]): number {
    const nonNull = vals.filter((v): v is number => v != null);
    if (nonNull.length === 0) return 0;
    return nonNull.reduce((a, b) => a + b, 0) / nonNull.length;
  }

  const avgCalories7d = Math.round(avg(logs7.map((l) => l.caloriesIn)));
  const avgProtein7d = Math.round(avg(logs7.map((l) => l.proteinG)));
  const avgSteps7d = Math.round(avg(logs7.map((l) => l.steps)));

  // ── Workout counts ─────────────────────────────────────────────────────────
  const workouts7 = db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, USER_ID), gte(workouts.date, cutoff7Str)))
    .all();

  const workouts30 = db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, USER_ID), gte(workouts.date, cutoff30Str)))
    .all();

  const workoutsLast7d = workouts7.length;
  const workoutsLast30d = workouts30.length;

  // ── Streak ─────────────────────────────────────────────────────────────────
  const logDates = new Set(logs30.map((l) => l.date));
  let streak = 0;
  const today = now.toISOString().slice(0, 10);
  const check = new Date(now);
  for (let i = 0; i < 30; i++) {
    const d = check.toISOString().slice(0, 10);
    if (logDates.has(d)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else if (i === 0 && d === today) {
      // today not logged yet — skip today and check yesterday
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  // ── BWS Score ──────────────────────────────────────────────────────────────
  const weightProgress = Math.round(
    clamp(1 - Math.abs(weightDelta7d ?? 0) / 0.5, 0, 1) * 25,
  );
  const nutritionScore = Math.round(clamp(avgCalories7d / 1850, 0, 1) * 25);
  const proteinScore = Math.round(clamp(avgProtein7d / 180, 0, 1) * 25);
  const activityScore = Math.round(
    clamp(avgSteps7d / 10000, 0, 1) * 12.5 + clamp(workoutsLast7d / 4, 0, 1) * 12.5,
  );

  const bwsScore = Math.round(weightProgress + nutritionScore + proteinScore + activityScore);

  const payload = {
    currentWeight,
    weightDelta7d,
    weightDelta30d,
    avgCalories7d,
    avgProtein7d,
    avgSteps7d,
    workoutsLast7d,
    workoutsLast30d,
    streak,
    bwsScore,
    breakdown: {
      weightProgress,
      nutritionScore,
      proteinScore,
      activityScore,
    },
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
