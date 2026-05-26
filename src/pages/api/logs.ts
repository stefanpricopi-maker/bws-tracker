import type { APIRoute } from 'astro';
import { db } from '../../db';
import { dailyLogs } from '../../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

// Hardcoded to user 1 until auth is introduced in a later phase
const USER_ID = 1;

// ── GET /api/logs?days=30 ──────────────────────────────────────────────────
export const GET: APIRoute = ({ url }) => {
  const days = parseInt(url.searchParams.get('days') ?? '30', 10);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), gte(dailyLogs.date, cutoffStr)))
    .orderBy(desc(dailyLogs.date))
    .all();

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// ── POST /api/logs ─────────────────────────────────────────────────────────
// Body (all fields optional except date):
//   { date, weight_kg, steps, calories_in, protein_g, carbs_g, fat_g }
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

  const patch = {
    ...(body.weight_kg   != null && { weightKg:    Number(body.weight_kg)   }),
    ...(body.steps       != null && { steps:        Number(body.steps)       }),
    ...(body.calories_in != null && { caloriesIn:   Number(body.calories_in) }),
    ...(body.protein_g   != null && { proteinG:     Number(body.protein_g)   }),
    ...(body.carbs_g     != null && { carbsG:       Number(body.carbs_g)     }),
    ...(body.fat_g       != null && { fatG:         Number(body.fat_g)       }),
  };

  // Manual upsert — check for existing row first
  const existing = db
    .select({ id: dailyLogs.id })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), eq(dailyLogs.date, date)))
    .get();

  if (existing) {
    db.update(dailyLogs)
      .set(patch)
      .where(eq(dailyLogs.id, existing.id))
      .run();
  } else {
    db.insert(dailyLogs)
      .values({ userId: USER_ID, date, ...patch })
      .run();
  }

  // Return the updated row
  const updated = db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, USER_ID), eq(dailyLogs.date, date)))
    .get();

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
