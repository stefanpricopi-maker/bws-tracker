import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { validateLogPatch } from '../../lib/logValidation';
import { db } from '../../db';
import { dailyLogs } from '../../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';


// ── GET /api/logs?days=30 ──────────────────────────────────────────────────
export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  // ?limit=N returns the N most recent rows regardless of date range (used by PhotoVault)
  const limitParam = url.searchParams.get('limit');
  if (limitParam) {
    const limit = Math.min(parseInt(limitParam, 10), 1000);
    const rows = await db
      .select()
      .from(dailyLogs)
      .where(eq(dailyLogs.userId, userId))
      .orderBy(desc(dailyLogs.date))
      .limit(limit);
    return new Response(JSON.stringify(rows.map(toClientRow)), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const days = parseInt(url.searchParams.get('days') ?? '30', 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, cutoffStr)))
    .orderBy(desc(dailyLogs.date));

  return new Response(JSON.stringify(rows.map(toClientRow)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Map DB column names (camelCase) to API names (snake_case) expected by components
function toClientRow(r: typeof dailyLogs.$inferSelect) {
  return {
    id:           r.id,
    user_id:      r.userId,
    date:         r.date,
    weight_kg:    r.weightKg,
    steps:        r.steps,
    calories_in:  r.caloriesIn,
    protein_g:    r.proteinG,
    carbs_g:      r.carbsG,
    fat_g:        r.fatG,
    photo_url:    r.photoUrl,
  };
}

// ── POST /api/logs ─────────────────────────────────────────────────────────
// Body (all fields optional except date):
//   { date, weight_kg, steps, calories_in, protein_g, carbs_g, fat_g }
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
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

  const validated = validateLogPatch(body);
  if (!validated.ok) {
    return new Response(JSON.stringify({ error: validated.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const patch = validated.patch;

  // Manual upsert — check for existing row first
  const [existing] = await db
    .select({ id: dailyLogs.id })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .limit(1);

  if (existing) {
    await db.update(dailyLogs)
      .set(patch)
      .where(eq(dailyLogs.id, existing.id));
  } else {
    await db.insert(dailyLogs)
      .values({ userId: userId, date, ...patch });
  }

  // Return the updated row
  const [updated] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .limit(1);

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
