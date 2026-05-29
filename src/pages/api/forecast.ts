import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { dailyLogs, userGoals } from '../../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { calcForecast } from '../../lib/fitness';

const DEFAULT_GOAL_KG = 83.6;

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const [goals] = await db
      .select({ targetWeightKg: userGoals.targetWeightKg })
      .from(userGoals)
      .where(eq(userGoals.userId, userId))
      .limit(1);

    const goalKg = goals?.targetWeightKg ?? DEFAULT_GOAL_KG;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 13);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const rows = await db
      .select({ date: dailyLogs.date, weightKg: dailyLogs.weightKg })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, cutoffStr)))
      .orderBy(desc(dailyLogs.date));

    const byDate = new Map(rows.map((r) => [r.date, r.weightKg]));
    const weights: (number | null)[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weights.push(byDate.get(key) ?? null);
    }

    const result = calcForecast({ weights, goalKg, today: new Date() });

    return new Response(
      JSON.stringify({ ...result, goalKg }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
