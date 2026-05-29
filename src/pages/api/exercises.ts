import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { validateExerciseImageUrl } from '../../lib/urlValidation';
import { db } from '../../db';
import { exercises } from '../../db/schema';
import { eq, sql, and, type SQL } from 'drizzle-orm';

const VALID_CATEGORIES = ['Push', 'Pull', 'Legs', 'Upper', 'Full Body'] as const;

const DEFAULT_EXERCISES: Array<{ name: string; targetMuscle: string; category: string }> = [
  { name: 'Dumbbell Floor Press',        targetMuscle: 'Chest',       category: 'Push' },
  { name: 'Deficit Push-ups',            targetMuscle: 'Chest',       category: 'Push' },
  { name: 'Banded Chest Flyes',          targetMuscle: 'Chest',       category: 'Push' },
  { name: 'Dumbbell Overhead Press',     targetMuscle: 'Shoulders',   category: 'Push' },
  { name: 'Dumbbell Lateral Raises',     targetMuscle: 'Shoulders',   category: 'Push' },
  { name: 'Banded Lateral Raises',       targetMuscle: 'Shoulders',   category: 'Push' },
  { name: 'Banded Triceps Pushdowns',    targetMuscle: 'Triceps',     category: 'Push' },
  { name: 'Dumbbell Floor Skullcrushers',targetMuscle: 'Triceps',     category: 'Push' },
  { name: 'Dumbbell Bent-Over Row',      targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Single-Arm Dumbbell Row',     targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Banded Lat Pulldown',         targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Dumbbell Pullover',           targetMuscle: 'Back',        category: 'Pull' },
  { name: 'Banded Face Pulls',           targetMuscle: 'Rear Delts',  category: 'Pull' },
  { name: 'Dumbbell Reverse Flyes',      targetMuscle: 'Rear Delts',  category: 'Pull' },
  { name: 'Dumbbell Biceps Curl',        targetMuscle: 'Biceps',      category: 'Pull' },
  { name: 'Banded Hammer Curl',          targetMuscle: 'Biceps',      category: 'Pull' },
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

// ── GET /api/exercises?limit=20&offset=0&category=Push ───────────────────────
export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  try {
    await ensureSeeded();
    const limit  = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 200), 500);
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const categoryParam = url.searchParams.get('category')?.trim() ?? '';
    const categoryOk = VALID_CATEGORIES.includes(categoryParam as (typeof VALID_CATEGORIES)[number]);

    const where: SQL = categoryOk
      ? and(eq(exercises.isArchived, false), eq(exercises.category, categoryParam))!
      : eq(exercises.isArchived, false);

    const rows = await db
      .select()
      .from(exercises)
      .where(where)
      .orderBy(exercises.category, exercises.name)
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(exercises)
      .where(where);

    return new Response(JSON.stringify({
      exercises: rows,
      total: Number(count),
      limit,
      offset,
      ...(categoryOk ? { category: categoryParam } : {}),
    }), {
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
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json() as {
      name?: string;
      target_muscle?: string;
      category?: string;
      image_url?: string;
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

    if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      return new Response(
        JSON.stringify({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const imageCheck = validateExerciseImageUrl(body.image_url);
    if (!imageCheck.ok) {
      return new Response(JSON.stringify({ error: imageCheck.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [inserted] = await db
      .insert(exercises)
      .values({
        name,
        targetMuscle,
        category,
        imageUrl: imageCheck.url,
        isCustom: true,
        isArchived: false,
      })
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
