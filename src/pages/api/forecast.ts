import type { APIRoute } from 'astro';
import { db } from '../../db';
import { dailyLogs, userGoals } from '../../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { calcForecast } from '../../lib/fitness';

const USER_ID    = 1;
const DEFAULT_GOAL_KG = 83.6;

export const GET: APIRoute = async () => {
  try {
    // Fetch user goal weight (fallback to 83.6 kg)
    const [goals] = await db
      .select({ targetWeightKg: userGoals.targetWeightKg })
      .from(userGoals)
      .where(eq(userGoals.userId, USER_ID))
      .limit(1);

    const goalKg = goals?.targetWeightKg ?? DEFAULT_GOAL_KG;

    // Fetch last 14 days of weight logs (oldest → newest)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 13); // 14 days inclusive
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const rows = await db
      .select({ date: dailyLogs.date, weightKg: dailyLogs.weightKg })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, USER_ID), gte(dailyLogs.date, cutoffStr)))
      .orderBy(desc(dailyLogs.date));

    // Build a slot array for the last 14 calendar days (null = no log)
    const byDate = new Map(rows.map(r => [r.date, r.weightKg]));
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
