import type { APIRoute } from 'astro';
import { db } from '../../db';
import { workouts, workoutSets } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';

const USER_ID = 1;

// ── GET /api/workouts?exercise_name=Bench+Press ────────────────────────────
export const GET: APIRoute = async ({ url }) => {
  const exerciseName = url.searchParams.get('exercise_name');

  if (!exerciseName) {
    return new Response(JSON.stringify({ error: 'exercise_name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find the most recent workout session that contains sets for this exercise
  const [latestWorkout] = await db
    .select({ workoutId: workoutSets.workoutId, date: workouts.date })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(and(eq(workouts.userId, USER_ID), eq(workoutSets.exerciseName, exerciseName)))
    .orderBy(desc(workouts.date))
    .limit(1);

  if (!latestWorkout) {
    return new Response(
      JSON.stringify({ lastWeight: null, lastReps: null, lastDate: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Get all sets from that workout for the given exercise, then pick max weight
  const sets = await db
    .select()
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.workoutId, latestWorkout.workoutId),
        eq(workoutSets.exerciseName, exerciseName),
      ),
    );

  const best = sets.reduce(
    (acc, s) => (s.weight > acc.weight ? s : acc),
    sets[0],
  );

  return new Response(
    JSON.stringify({
      lastWeight: best.weight,
      lastReps: best.reps,
      lastDate: latestWorkout.date,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

// ── POST /api/workouts ─────────────────────────────────────────────────────
// Body: { date: string, dayType: string, sets: Array<{ exerciseName, weight, reps, setNumber }> }
export const POST: APIRoute = async ({ request }) => {
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
    .values({ userId: USER_ID, date, dayType })
    .returning({ id: workouts.id });

  const workoutId = inserted.id;

  for (const s of rawSets) {
    if (
      typeof s === 'object' &&
      s !== null &&
      typeof s.exerciseName === 'string' &&
      typeof s.weight === 'number' &&
      typeof s.reps === 'number' &&
      typeof s.setNumber === 'number'
    ) {
      await db.insert(workoutSets)
        .values({
          workoutId,
          exerciseName: s.exerciseName,
          weight: s.weight,
          reps: s.reps,
          setNumber: s.setNumber,
        });
    }
  }

  return new Response(JSON.stringify({ ok: true, workoutId }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
