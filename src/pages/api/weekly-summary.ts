import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { dailyLogs, workouts, workoutSets, userGoals } from '../../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';


function isoWeekBounds(date: Date): { weekStart: string; weekEnd: string } {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

type SetRow = { exerciseName: string; weight: number; reps: number };

async function getSetsForWorkouts(ids: number[]): Promise<SetRow[]> {
  if (ids.length === 0) return [];
  const results = await Promise.all(
    ids.map((wid) =>
      db
        .select({
          exerciseName: workoutSets.exerciseName,
          weight: workoutSets.weight,
          reps: workoutSets.reps,
        })
        .from(workoutSets)
        .where(eq(workoutSets.workoutId, wid)),
    ),
  );
  return results.flat();
}

function volumeByExercise(sets: SetRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sets) {
    map.set(s.exerciseName, (map.get(s.exerciseName) ?? 0) + s.weight * s.reps);
  }
  return map;
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const now = new Date();
  const { weekStart, weekEnd } = isoWeekBounds(now);

  // Previous week bounds
  const prevMonday = new Date(weekStart);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevSunday = new Date(weekEnd);
  prevSunday.setDate(prevSunday.getDate() - 7);
  const prevWeekStart = prevMonday.toISOString().slice(0, 10);
  const prevWeekEnd = prevSunday.toISOString().slice(0, 10);

  const [goals = null] = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  const targetCalories = goals?.targetCaloriesKcal ?? 1850;
  const targetProtein = goals?.targetProteinG ?? 180;

  // ── This week's daily logs ─────────────────────────────────────────────────
  const thisWeekLogs = await db
    .select()
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, userId),
        gte(dailyLogs.date, weekStart),
        lte(dailyLogs.date, weekEnd),
      ),
    )
    .orderBy(desc(dailyLogs.date));

  // ── Weight lost ────────────────────────────────────────────────────────────
  const weightLogsThisWeek = thisWeekLogs.filter((l) => l.weightKg != null);
  let weightLostKg: number | null = null;
  if (weightLogsThisWeek.length >= 2) {
    const latest = weightLogsThisWeek[0].weightKg!;
    const earliest = weightLogsThisWeek[weightLogsThisWeek.length - 1].weightKg!;
    weightLostKg = parseFloat((earliest - latest).toFixed(2));
  } else if (weightLogsThisWeek.length === 1) {
    // Try previous week for start weight
    const prevWeekWeightLogs = await db
      .select()
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, prevWeekStart),
          lte(dailyLogs.date, prevWeekEnd),
        ),
      )
      .orderBy(desc(dailyLogs.date));
    const prevWeekWeightLog = prevWeekWeightLogs.find((l) => l.weightKg != null);
    if (prevWeekWeightLog) {
      weightLostKg = parseFloat((prevWeekWeightLog.weightKg! - weightLogsThisWeek[0].weightKg!).toFixed(2));
    }
  }

  // ── Workout count + days trained ───────────────────────────────────────────
  const thisWeekWorkouts = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, weekStart),
        lte(workouts.date, weekEnd),
      ),
    );

  const workoutCount = thisWeekWorkouts.length;
  const daysTrained = new Set(thisWeekWorkouts.map((w) => w.date)).size;

  // ── Calorie & protein adherence ────────────────────────────────────────────
  const calLogs = thisWeekLogs.filter((l) => l.caloriesIn != null);
  const proteinLogs = thisWeekLogs.filter((l) => l.proteinG != null);

  const calHitDays = calLogs.filter((l) => (l.caloriesIn ?? 0) >= targetCalories * 0.8).length;
  const proteinHitDays = proteinLogs.filter((l) => (l.proteinG ?? 0) >= targetProtein * 0.9).length;

  const totalDaysWithCalData = calLogs.length;
  const totalDaysWithProteinData = proteinLogs.length;

  const calorieAdherence =
    totalDaysWithCalData > 0 ? Math.round((calHitDays / totalDaysWithCalData) * 100) : 0;
  const proteinAdherence =
    totalDaysWithProteinData > 0
      ? Math.round((proteinHitDays / totalDaysWithProteinData) * 100)
      : 0;

  // ── Best exercise: highest volume delta vs last week ──────────────────────
  const thisWeekWorkoutIds = thisWeekWorkouts.map((w) => w.id);
  const prevWeekWorkouts = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, prevWeekStart),
        lte(workouts.date, prevWeekEnd),
      ),
    );
  const prevWeekWorkoutIds = prevWeekWorkouts.map((w) => w.id);

  const thisWeekSets = await getSetsForWorkouts(thisWeekWorkoutIds);
  const prevWeekSets = await getSetsForWorkouts(prevWeekWorkoutIds);
  const thisVol = volumeByExercise(thisWeekSets);
  const prevVol = volumeByExercise(prevWeekSets);

  let bestExercise: { name: string; volumeDelta: number } | null = null;
  for (const [name, vol] of thisVol.entries()) {
    const prev = prevVol.get(name) ?? 0;
    const delta = vol - prev;
    if (bestExercise === null || delta > bestExercise.volumeDelta) {
      bestExercise = { name, volumeDelta: Math.round(delta) };
    }
  }
  // Only report if there's a positive delta
  if (bestExercise && bestExercise.volumeDelta <= 0) bestExercise = null;

  // ── Summary text ───────────────────────────────────────────────────────────
  const parts: string[] = [];
  if (weightLostKg != null && weightLostKg > 0) parts.push(`Lost ${weightLostKg} kg`);
  else if (weightLostKg != null && weightLostKg < 0) parts.push(`Gained ${Math.abs(weightLostKg)} kg`);
  if (workoutCount > 0) parts.push(`${workoutCount} workout${workoutCount !== 1 ? 's' : ''}`);
  if (totalDaysWithProteinData > 0)
    parts.push(`Protein hit ${proteinHitDays}/${totalDaysWithProteinData} days`);
  if (bestExercise) parts.push(`PR on ${bestExercise.name}`);
  const summaryText = parts.length > 0 ? parts.join(' · ') : 'No data yet this week.';

  return new Response(
    JSON.stringify({
      weekStart,
      weekEnd,
      weightLostKg,
      workoutCount,
      daysTrained,
      calorieAdherence,
      proteinAdherence,
      bestExercise,
      summaryText,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
