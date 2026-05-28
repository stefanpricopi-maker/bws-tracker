import type { APIRoute } from 'astro';
import { db } from '../../db';
import { exercises } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

// ── Default home-gym exercise seed ────────────────────────────────────────────
const DEFAULT_EXERCISES: Array<{ name: string; targetMuscle: string; category: string }> = [
  // Push
  { name: 'Dumbbell Floor Press',        targetMuscle: 'Chest',       category: 'Push' },
  { name: 'Deficit Push-ups',            targetMuscle: 'Chest',       category: 'Push' },
  { name: 'Banded Chest Flyes',          targetMuscle: 'Chest',       category: 'Push' },
  { name: 'Dumbbell Overhead Press',     targetMuscle: 'Shoulders',   category: 'Push' },
  { name: 'Dumbbell Lateral Raises',     targetMuscle: 'Shoulders',   category: 'Push' },
  { name: 'Banded Lateral Raises',       targetMuscle: 'Shoulders',   category: 'Push' },
  { name: 'Banded Triceps Pushdowns',    targetMuscle: 'Triceps',     category: 'Push' },
  { name: 'Dumbbell Floor Skullcrushers',targetMuscle: 'Triceps',     category: 'Push' },
  // Pull
  { name: 'Dumbbell Bent-Over Row',      targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Single-Arm Dumbbell Row',     targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Banded Lat Pulldown',         targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Dumbbell Pullover',           targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Banded Face Pulls',           targetMuscle: 'Rear Delts',  category: 'Pull' },
  { name: 'Dumbbell Reverse Flyes',      targetMuscle: 'Rear Delts',  category: 'Pull' },
  { name: 'Dumbbell Biceps Curl',        targetMuscle: 'Biceps',      category: 'Pull' },
  { name: 'Banded Hammer Curl',          targetMuscle: 'Biceps',      category: 'Pull' },
  // Legs
  { name: 'Bulgarian Split Squats',      targetMuscle: 'Quads',       category: 'Legs' },
  { name: 'Dumbbell Goblet Squats',      targetMuscle: 'Quads',       category: 'Legs' },
  { name: 'Dumbbell Romanian Deadlifts', targetMuscle: 'Hamstrings',  category: 'Legs' },
  { name: 'Single-Leg RDLs',            targetMuscle: 'Hamstrings',  category: 'Legs' },
  { name: 'Banded Lying Leg Curls',     targetMuscle: 'Hamstrings',  category: 'Legs' },
  { name: 'Single-Leg Calf Raises',     targetMuscle: 'Calves',      category: 'Legs' },
];

async function ensureSeeded() {
  const existing = await db.select({ id: exercises.id }).from(exercises).limit(1);
  if (existing.length === 0) {
    await db.insert(exercises).values(
      DEFAULT_EXERCISES.map((e) => ({ ...e, isCustom: false, isArchived: false })),
    );
  }
}

// ── GET /api/exercises ─────────────────────────────────────────────────────────
export const GET: APIRoute = async () => {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(exercises)
      .where(eq(exercises.isArchived, false))
      .orderBy(exercises.category, exercises.name);

    return new Response(JSON.stringify({ exercises: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('GET /api/exercises error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// ── POST /api/exercises ────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      name?: string;
      target_muscle?: string;
      category?: string;
    };

    const name         = body.name?.trim() ?? '';
    const targetMuscle = body.target_muscle?.trim() ?? '';
    const category     = body.category?.trim() ?? '';

    if (!name || !targetMuscle || !category) {
      return new Response(
        JSON.stringify({ error: 'name, target_muscle, and category are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const validCategories = ['Push', 'Pull', 'Legs', 'Upper', 'Full Body'];
    if (!validCategories.includes(category)) {
      return new Response(
        JSON.stringify({ error: `category must be one of: ${validCategories.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const [inserted] = await db
      .insert(exercises)
      .values({ name, targetMuscle, category, isCustom: true, isArchived: false })
      .returning();

    return new Response(JSON.stringify({ exercise: inserted }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('UNIQUE constraint') || msg.includes('SQLITE_CONSTRAINT')) {
      return new Response(
        JSON.stringify({ error: 'An exercise with that name already exists.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }
    console.error('POST /api/exercises error:', err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
