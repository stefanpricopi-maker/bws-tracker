/**
 * POST /api/workout-set
 *
 * Saves a single set during an active workout session.
 * - If `workout_id` is omitted, a new workout record is created and its id returned.
 * - Subsequent calls pass the returned `workout_id` to append sets to the same session.
 *
 * Body: {
 *   workout_id?:    number   // omit on first call
 *   day_type?:      string   // required only on first call (e.g. "Push")
 *   exercise_name:  string
 *   weight:         number
 *   reps:           number
 *   set_number:     number
 * }
 *
 * Response: { workout_id: number }
 */
import type { APIRoute } from 'astro';
import { db } from '../../db';
import { workouts, workoutSets } from '../../db/schema';
import { eq } from 'drizzle-orm';

const USER_ID = 1;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      workout_id?:    number;
      day_type?:      string;
      exercise_name:  string;
      weight:         number;
      reps:           number;
      set_number:     number;
    };

    const { exercise_name, weight, reps, set_number } = body;

    if (!exercise_name || weight == null || reps == null || set_number == null) {
      return new Response(
        JSON.stringify({ error: 'exercise_name, weight, reps, and set_number are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    let workoutId = body.workout_id;

    if (!workoutId) {
      // Create a new workout session
      const dayType = body.day_type ?? 'Workout';
      const today   = new Date().toISOString().slice(0, 10);
      const [created] = await db
        .insert(workouts)
        .values({ userId: USER_ID, date: today, dayType })
        .returning({ id: workouts.id });
      workoutId = created.id;
    } else {
      // Verify the workout exists (guard against stale IDs)
      const [existing] = await db
        .select({ id: workouts.id })
        .from(workouts)
        .where(eq(workouts.id, workoutId))
        .limit(1);
      if (!existing) {
        return new Response(
          JSON.stringify({ error: `workout_id ${workoutId} not found.` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    await db.insert(workoutSets).values({
      workoutId,
      exerciseName: exercise_name,
      weight,
      reps,
      setNumber: set_number,
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
