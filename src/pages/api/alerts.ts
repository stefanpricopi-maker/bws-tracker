import type { APIRoute } from 'astro';
import { db } from '../../db';
import { dailyLogs, workouts, userGoals } from '../../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

const USER_ID = 1;

interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
}

export const GET: APIRoute = () => {
  const now = new Date();

  const goals = db.select().from(userGoals).where(eq(userGoals.userId, USER_ID)).get() ?? null;
  const targetCalories = goals?.targetCaloriesKcal ?? 1850;
  const targetSteps = goals?.targetSteps ?? 10000;

  // Last 7 days cutoff
  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff7Str = cutoff7.toISOString().slice(0, 10);

  const logs7 = db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), gte(dailyLogs.date, cutoff7Str)))
    .orderBy(desc(dailyLogs.date))
    .all();

  const workouts7 = db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, USER_ID), gte(workouts.date, cutoff7Str)))
    .orderBy(desc(workouts.date))
    .all();

  const alerts: Alert[] = [];

  // ── Stall: weight entries for last 5 days, max - min < 0.15 kg ────────────
  const cutoff5 = new Date(now);
  cutoff5.setDate(cutoff5.getDate() - 5);
  const cutoff5Str = cutoff5.toISOString().slice(0, 10);

  const weightLogs5 = logs7
    .filter((l) => l.date >= cutoff5Str && l.weightKg != null)
    .map((l) => l.weightKg as number);

  if (weightLogs5.length >= 5) {
    const maxW = Math.max(...weightLogs5);
    const minW = Math.min(...weightLogs5);
    if (maxW - minW < 0.15) {
      alerts.push({
        id: 'stall',
        type: 'warning',
        title: 'Weight Stall Detected',
        message:
          "Your weight hasn't moved in 5 days. Consider adjusting calories or adding cardio.",
      });
    }
  }

  // ── Undereating: avg calories last 3 logged days < 80% of target ──────────
  const calLogs3 = logs7.filter((l) => l.caloriesIn != null).slice(0, 3);
  if (calLogs3.length >= 3) {
    const avgCal = calLogs3.reduce((s, l) => s + (l.caloriesIn ?? 0), 0) / calLogs3.length;
    if (avgCal < targetCalories * 0.8) {
      const rounded = Math.round(avgCal);
      alerts.push({
        id: 'undereating',
        type: 'danger',
        title: 'Calorie Deficit Too Large',
        message: `You've eaten ${rounded} kcal/day avg this week. Too large a deficit risks muscle loss.`,
      });
    }
  }

  // ── Inactivity: no workout in last 4 days ─────────────────────────────────
  const cutoff4 = new Date(now);
  cutoff4.setDate(cutoff4.getDate() - 4);
  const cutoff4Str = cutoff4.toISOString().slice(0, 10);

  const recentWorkout = workouts7.find((w) => w.date >= cutoff4Str);
  if (!recentWorkout) {
    alerts.push({
      id: 'inactivity',
      type: 'warning',
      title: 'No Recent Workouts',
      message: "It's been 4+ days since your last session. Your split calls for consistency.",
    });
  }

  // ── Step deficit: avg steps last 3 logged days < 60% of target ───────────
  const stepLogs3 = logs7.filter((l) => l.steps != null).slice(0, 3);
  if (stepLogs3.length >= 3) {
    const avgSteps = stepLogs3.reduce((s, l) => s + (l.steps ?? 0), 0) / stepLogs3.length;
    if (avgSteps < targetSteps * 0.6) {
      const rounded = Math.round(avgSteps);
      alerts.push({
        id: 'step_deficit',
        type: 'info',
        title: 'Low NEAT Activity',
        message: `Averaging ${rounded} steps/day — below your ${targetSteps.toLocaleString()} target. Add a walk.`,
      });
    }
  }

  return new Response(JSON.stringify({ alerts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
