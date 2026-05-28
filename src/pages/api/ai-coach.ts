import type { APIRoute } from 'astro';
import { db } from '../../db';
import { dailyLogs } from '../../db/schema';
import { eq, gte, desc } from 'drizzle-orm';

// Reuse the same OpenAI-compatible env vars as the vision endpoint
const BASE_URL = process.env['AI_API_BASE_URL'] ?? 'https://api.openai.com/v1';
const API_KEY  = process.env['AI_API_KEY'];
const MODEL    = process.env['AI_MODEL'] ?? 'gpt-4o';

const USER_ID = 1;

// ── Built-With-Science system prompt ─────────────────────────────────────────

function buildPrompt(
  data: Array<{ date: string; weight: number | null; calories: number | null; steps: number | null }>,
  weightDelta: number | null,
): string {
  const avgSteps = (() => {
    const rows = data.filter((d) => d.steps !== null);
    if (!rows.length) return null;
    return Math.round(rows.reduce((s, d) => s + d.steps!, 0) / rows.length);
  })();

  const avgCalories = (() => {
    const rows = data.filter((d) => d.calories !== null && d.calories > 0);
    if (!rows.length) return null;
    return Math.round(rows.reduce((s, d) => s + d.calories!, 0) / rows.length);
  })();

  const summary = {
    period:           `${data[0]?.date ?? '?'} → ${data[data.length - 1]?.date ?? '?'}`,
    days_logged:      data.filter((d) => d.calories !== null || d.steps !== null).length,
    weight_change_kg: weightDelta !== null ? Math.round(weightDelta * 100) / 100 : null,
    avg_daily_kcal:   avgCalories,
    avg_daily_steps:  avgSteps,
    daily_breakdown:  data.map((d) => ({
      date:     d.date,
      weight:   d.weight,
      calories: d.calories,
      steps:    d.steps,
    })),
  };

  return `You are a strict, math-based fitness coach following the Built With Science methodology. Analyze this 7-day user data: ${JSON.stringify(summary, null, 2)}.

Rules to apply — state which rule applies and why:
Rule 1: If weight loss is between 0.5 kg and 0.8 kg, tell them to maintain their current 1850 kcal target.
Rule 2: If weight loss is less than 0.2 kg and average steps are below 10000, tell them to increase NEAT (steps) before dropping calories.
Rule 3: If weight loss is more than 0.8 kg per week, warn them they're losing too fast and risk muscle loss — tell them to increase calories by 100–150 kcal.
Rule 4: If calorie data is missing for 3 or more days, tell them to prioritize logging consistency above all else.

Keep the response under 3 sentences. Be direct, no fluff. Do not repeat the numbers back at length — give the diagnosis and the single action to take.`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const GET: APIRoute = async () => {
  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY is not configured. Add it to your .env file.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Fetch the last 7 days of daily_logs
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      date:      dailyLogs.date,
      weight:    dailyLogs.weightKg,
      calories:  dailyLogs.caloriesIn,
      steps:     dailyLogs.steps,
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, USER_ID))
    .orderBy(desc(dailyLogs.date));

  // Build a full 7-day window, filling missing dates with nulls
  const logMap = new Map(rows.map((r) => [r.date, r]));
  const window = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const r = logMap.get(date);
    return { date, weight: r?.weight ?? null, calories: r?.calories ?? null, steps: r?.steps ?? null };
  });

  // Weight delta: newest minus oldest non-null weight entry
  const withWeight = window.filter((d) => d.weight !== null);
  const weightDelta =
    withWeight.length >= 2
      ? withWeight[withWeight.length - 1].weight! - withWeight[0].weight!
      : null;

  const prompt = buildPrompt(window, weightDelta);

  // Call the LLM
  try {
    const llmRes = await fetch(`${BASE_URL}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model:    MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 220,
        temperature: 0.4,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      throw new Error(`LLM API error ${llmRes.status}: ${err}`);
    }

    const json = await llmRes.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const advice = json.choices?.[0]?.message?.content?.trim() ?? 'No response from model.';

    return new Response(
      JSON.stringify({ advice, weightDelta, window }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('ai-coach error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
