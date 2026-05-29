import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { workouts, workoutSets } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { detectDeload } from '../../lib/fitness';
import { validateBulkSetRow } from '../../lib/workoutValidation';


// ── GET /api/workouts?exercise_name=Bench+Press ────────────────────────────
export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request, 'workouts');
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const exerciseName = url.searchParams.get('exercise_name');

  if (!exerciseName) {
    return new Response(JSON.stringify({ error: 'exercise_name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch the last 3 distinct workout sessions containing sets for this exercise
  const recentSessions = await db
    .selectDistinct({ workoutId: workoutSets.workoutId, date: workouts.date })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(and(eq(workouts.userId, userId), eq(workoutSets.exerciseName, exerciseName)))
    .orderBy(desc(workouts.date))
    .limit(3);

  if (recentSessions.length === 0) {
    return new Response(
      JSON.stringify({ lastWeight: null, lastReps: null, lastDate: null, maxWeight: null, maxReps: null, needs_deload: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // For each session, find the best set (highest weight; ties broken by highest reps)
  const sessionBests = await Promise.all(
    recentSessions.map(async (session) => {
      const sets = await db
        .select()
        .from(workoutSets)
        .where(
          and(
            eq(workoutSets.workoutId, session.workoutId),
            eq(workoutSets.exerciseName, exerciseName),
          ),
        );
      const best = sets.reduce((acc, s) => {
        if (s.weight > acc.weight) return s;
        if (s.weight === acc.weight && s.reps > acc.reps) return s;
        return acc;
      }, sets[0]);
      return { maxWeight: best.weight, maxReps: best.reps, date: session.date as string };
    }),
  );

  // Most recent session is sessionBests[0] (DESC order)
  const latest = sessionBests[0];

  // detectDeload expects oldest → newest; reverse the DESC array
  const oldestToNewest = [...sessionBests].reverse();
  const needs_deload = detectDeload(oldestToNewest);

  return new Response(
    JSON.stringify({
      lastWeight:   latest.maxWeight,
      lastReps:     latest.maxReps,
      lastDate:     latest.date,
      maxWeight:    latest.maxWeight,
      maxReps:      latest.maxReps,
      needs_deload,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

// ── POST /api/workouts ─────────────────────────────────────────────────────
// Body: { date: string, dayType: string, sets: Array<{ exerciseName, weight, reps, setNumber }> }
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'workouts');
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const date = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10);
  const dayType = typeof body.dayType === 'string' ? body.dayType : 'Unknown';
  const rawSets = Array.isArray(body.sets) ? body.sets : [];

  const [inserted] = await db
    .insert(workouts)
    .values({ userId: userId, date, dayType })
    .returning({ id: workouts.id });

  const workoutId = inserted.id;

  let savedCount = 0;
  for (const s of rawSets) {
    const validated = validateBulkSetRow(s);
    if (!validated) continue;
    await db.insert(workoutSets).values({
      workoutId,
      exerciseName: validated.exerciseName,
      weight:       validated.weight,
      reps:         validated.reps,
      setNumber:    validated.setNumber,
    });
    savedCount++;
  }

  if (rawSets.length > 0 && savedCount === 0) {
    await db.delete(workouts).where(eq(workouts.id, workoutId));
    return new Response(
      JSON.stringify({ error: 'No valid sets in payload. Check weight (0–500 kg) and reps (1–100).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true, workoutId }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
