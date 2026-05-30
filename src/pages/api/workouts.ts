import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { workouts, workoutSets } from '../../db/schema';
import { eq, desc, and, gte, like } from 'drizzle-orm';
import { detectDeload } from '../../lib/fitness';
import { validateBulkSetRow } from '../../lib/workoutValidation';
import { googleFitDayType, parseGoogleFitSessionId } from '../../lib/googleFitWorkout';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── GET /api/workouts?exercise_name=… | ?days=7 ───────────────────────────
export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request, 'workouts');
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const daysParam = url.searchParams.get('days');
  const exerciseName = url.searchParams.get('exercise_name');

  if (daysParam !== null && !exerciseName) {
    const days = Math.min(30, Math.max(1, Number(daysParam) || 7));
    const start = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    const rows = await db
      .select({ id: workouts.id, date: workouts.date, dayType: workouts.dayType })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), gte(workouts.date, start)))
      .orderBy(desc(workouts.date));

    return new Response(
      JSON.stringify(rows.map((r) => ({
        ...r,
        googleFitSessionId: parseGoogleFitSessionId(r.dayType),
      }))),
      { status: 200, headers: JSON_HEADERS },
    );
  }

  if (!exerciseName) {
    return new Response(JSON.stringify({ error: 'exercise_name or days is required' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

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
      { status: 200, headers: JSON_HEADERS },
    );
  }

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

  const latest = sessionBests[0];
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
    { status: 200, headers: JSON_HEADERS },
  );
};

// ── POST /api/workouts ─────────────────────────────────────────────────────
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
      headers: JSON_HEADERS,
    });
  }

  const date = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10);
  const dayType = typeof body.dayType === 'string' ? body.dayType : 'Unknown';
  const rawSets = Array.isArray(body.sets) ? body.sets : [];
  const googleFitSessionId =
    typeof body.googleFitSessionId === 'string' ? body.googleFitSessionId.trim() : '';
  const activityLabel =
    typeof body.activityLabel === 'string' ? body.activityLabel.trim() : '';

  let finalDayType = dayType;
  if (googleFitSessionId) {
    const prefix = `[gfit:${googleFitSessionId}]`;
    const [existing] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), like(workouts.dayType, `${prefix}%`)))
      .limit(1);

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'already_imported', message: 'Acest antrenament Google Fit e deja în workouts.' }),
        { status: 409, headers: JSON_HEADERS },
      );
    }

    const label = activityLabel || dayType.replace(/^Cardio ·\s*/, '') || 'Cardio';
    finalDayType = googleFitDayType(googleFitSessionId, label);
  }

  const [inserted] = await db
    .insert(workouts)
    .values({ userId: userId, date, dayType: finalDayType })
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
      { status: 400, headers: JSON_HEADERS },
    );
  }

  return new Response(JSON.stringify({ ok: true, workoutId }), {
    status: 201,
    headers: JSON_HEADERS,
  });
};
