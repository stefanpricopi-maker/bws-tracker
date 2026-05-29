/**
 * POST /api/workout-set — save one set during an active player session.
 * DELETE /api/workout-set?workout_id=N — remove incomplete session (quit mid-workout).
 */
import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { workouts, workoutSets } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { validateSetPayload } from '../../lib/workoutValidation';


export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  try {
    const body = await request.json() as Record<string, unknown>;

    const validated = validateSetPayload({
      exercise_name: body.exercise_name,
      weight:        body.weight,
      reps:          body.reps,
      set_number:    body.set_number,
    });

    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { exerciseName, weight, reps, setNumber } = validated.data;

    let workoutId = typeof body.workout_id === 'number' ? body.workout_id : Number(body.workout_id);

    if (!workoutId || !Number.isInteger(workoutId)) {
      const dayType = typeof body.day_type === 'string' ? body.day_type : 'Workout';
      const today   = new Date().toISOString().slice(0, 10);
      const [created] = await db
        .insert(workouts)
        .values({ userId: userId, date: today, dayType })
        .returning({ id: workouts.id });
      workoutId = created.id;
    } else {
      const [existing] = await db
        .select({ id: workouts.id })
        .from(workouts)
        .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
        .limit(1);
      if (!existing) {
        return new Response(
          JSON.stringify({ error: `workout_id ${workoutId} not found.` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    const rpeRaw = body.rpe;
    const rpeVal =
      typeof rpeRaw === 'number' && rpeRaw >= 1 && rpeRaw <= 10
        ? rpeRaw
        : typeof rpeRaw === 'string' && rpeRaw !== ''
          ? Number(rpeRaw)
          : null;

    await db.insert(workoutSets).values({
      workoutId,
      exerciseName,
      weight,
      reps,
      setNumber,
      rpe: rpeVal != null && rpeVal >= 1 && rpeVal <= 10 ? rpeVal : null,
    });

    return new Response(
      JSON.stringify({ workout_id: workoutId }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('POST /api/workout-set error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

/** Delete a partial workout so it does not pollute auto-regulation history. */
export const DELETE: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const workoutId = parseInt(url.searchParams.get('workout_id') ?? '', 10);
  if (!Number.isInteger(workoutId) || workoutId < 1) {
    return new Response(JSON.stringify({ error: 'workout_id query param required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [row] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);

  if (!row) {
    return new Response(JSON.stringify({ error: 'Workout not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await db.delete(workouts).where(eq(workouts.id, workoutId));

  return new Response(JSON.stringify({ ok: true, deleted: workoutId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
