import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { userGoals } from '../../db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env['AI_API_BASE_URL'] ?? 'https://api.openai.com/v1';
const API_KEY  = process.env['AI_API_KEY'];
const MODEL    = process.env['AI_MODEL'] ?? 'gpt-4o';


// ── JSON schema description sent to the LLM ───────────────────────────────────
const SCHEMA = `{
  "meals": [
    {
      "meal_name": "string",
      "ingredients": [
        { "item": "string", "amount_g": number, "protein": number, "carbs": number, "fat": number, "calories": number }
      ],
      "total_calories": number
    }
  ],
  "daily_totals": { "calories": number, "protein": number, "carbs": number, "fat": number }
}`;

function buildPrompt(targets: {
  calories: number;
  protein:  number;
  fat:      number;
  carbs:    number;
}): string {
  return `You are a strict nutrition calculator. The user needs exactly:
${targets.calories} kcal, ${targets.protein}g Protein, ${targets.fat}g Fat, ${targets.carbs}g Carbs.

Generate a 3-meal plan for today (Breakfast, Lunch, Dinner) that hits these macros exactly (+/- 5% margin of error).
Use only common whole foods: chicken breast, rice, eggs, whey protein powder, oats, sweet potato, broccoli, spinach, olive oil, Greek yogurt, cottage cheese, tuna.
Weigh every ingredient to the nearest 5g. Be precise — this is a mathematical nutrition plan, not a recipe suggestion.

You MUST return ONLY a valid JSON object matching this exact schema, with no markdown, no backticks, no explanation text before or after:
${SCHEMA}

All numbers must be rounded to 1 decimal place. Verify that daily_totals matches the sum of all meals before responding.`;
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'macro-solver', 10);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Read user's actual targets (fall back to defaults)
  const [goals = null] = await db
    .select()
    .from(userGoals)
    .where(eq(userGoals.userId, userId))
    .limit(1);

  const targets = {
    calories: goals?.targetCaloriesKcal ?? 1850,
    protein:  goals?.targetProteinG     ?? 180,
    fat:      goals?.targetFatG         ?? 75,
    carbs:    goals?.targetCarbsG       ?? 113,
  };

  const prompt = buildPrompt(targets);

  try {
    const body: Record<string, unknown> = {
      model:       MODEL,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  1200,
      temperature: 0.2,
    };

    // Enable JSON mode if the endpoint supports it (OpenAI and most Groq models do)
    // Guarded behind a check so it doesn't break providers that reject this field
    if (!BASE_URL.includes('anthropic')) {
      body.response_format = { type: 'json_object' };
    }

    const llmRes = await fetch(`${BASE_URL}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      throw new Error(`LLM API error ${llmRes.status}: ${errText}`);
    }

    const llmJson = await llmRes.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const raw = llmJson.choices?.[0]?.message?.content?.trim() ?? '';

    // Validate that the response is parseable JSON before forwarding
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Model returned non-JSON response: ${raw.slice(0, 200)}`);
    }

    return new Response(
      JSON.stringify({ plan: parsed, targets }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('macro-solver error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
