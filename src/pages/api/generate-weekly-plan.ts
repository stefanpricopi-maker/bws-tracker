import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { exercises, mesocycles } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { isDeloadWeek, deloadSetCount, weeksElapsed } from '../../lib/periodization';
const BASE_URL = process.env['AI_API_BASE_URL'] ?? 'https://api.openai.com/v1';
const API_KEY  = process.env['AI_API_KEY'];
const MODEL    = process.env['AI_MODEL'] ?? 'gpt-4o';

function systemPrompt(isDeload: boolean): string {
  const volumeNote = isDeload
    ? `\nIMPORTANT: This is MESOCYCLE DELOAD WEEK. Reduce every exercise to ~60% of normal sets (e.g. 3→2, 4→2). Keep the same exercises.`
    : '';
  return `You are a strict Built With Science fitness coach.
Your job is to create a personalised weekly workout split for a home-gym athlete (dumbbells and resistance bands only).
You will be given the user's full exercise library as a JSON array.
You MUST only use exercise names that appear EXACTLY in the provided list — do not invent, rename, or paraphrase any exercise.
Apply proper volume balance: Push days hit chest/shoulders/triceps, Pull days hit back/biceps/rear-delts, Leg days hit quads/hamstrings/calves.

Volume rules (apply per exercise):
- Primary compound (first exercise per day): 4 sets
- Secondary compound: 3 sets
- Isolation for large muscles (back, chest, quads, hamstrings): 3 sets
- Isolation for small muscles (biceps, triceps, rear delts, calves, lateral delts): 2-3 sets
- Total weekly sets per muscle group must stay between 10-20 (hypertrophy range).${volumeNote}

Return ONLY a valid JSON object with NO markdown, NO backticks, NO explanation. The schema:
{
  "split_type": "3-day" | "5-day",
  "days": [
    {
      "day_name": "string",
      "category": "Push" | "Pull" | "Legs" | "Upper" | "Rest",
      "exercises": [
        { "name": "string", "sets": number }
      ]
    }
  ]
}
Each training day must have 5-7 exercises. Rest days must have an empty "exercises" array.`;
}

function buildUserPrompt(
  exerciseList: Array<{ name: string; category: string; targetMuscle: string }>,
  isDeload: boolean,
): string {
  const deload = isDeload ? ' This is deload week — use fewer sets per exercise.' : '';
  return `Here is the user's full exercise library:
${JSON.stringify(exerciseList, null, 2)}

Create a balanced 5-day workout split (Push / Pull / Legs / Upper / Rest) using ONLY the exercises in this list.
Pick exercises that cover all muscle groups without overlap. Prioritise compound movements first per day.${deload}`;
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'generate-weekly-plan', 10);
  if (auth instanceof Response) return auth;

  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const rows = await db
      .select({
        name:         exercises.name,
        category:     exercises.category,
        targetMuscle: exercises.targetMuscle,
      })
      .from(exercises)
      .where(eq(exercises.isArchived, false))
      .orderBy(exercises.category, exercises.name);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No exercises found in the database. Please seed the exercise library first.' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { userId } = auth;
    const [meso] = await db
      .select()
      .from(mesocycles)
      .where(eq(mesocycles.userId, userId))
      .limit(1);
    const weeks = meso ? weeksElapsed(meso.blockStartDate) : 0;
    const isDeload = isDeloadWeek(weeks);

    const body: Record<string, unknown> = {
      model:       MODEL,
      messages:    [
        { role: 'system', content: systemPrompt(isDeload) },
        { role: 'user',   content: buildUserPrompt(rows, isDeload) },
      ],
      max_tokens:  1200,
      temperature: 0.3,
    };

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

    let plan: unknown;
    try {
      plan = JSON.parse(raw);
    } catch {
      throw new Error(`Model returned non-JSON: ${raw.slice(0, 300)}`);
    }

    const validNames = new Set(rows.map((r) => r.name));
    type PlanExercise = { name: string; sets: number };
    type PlanDay = { day_name: string; category: string; exercises: PlanExercise[] };
    const typed = plan as { split_type?: string; days?: PlanDay[]; isDeloadWeek?: boolean };
    if (typed?.days) {
      for (const day of typed.days) {
        if (!Array.isArray(day.exercises)) { day.exercises = []; continue; }
        day.exercises = day.exercises
          .filter((ex) => {
            if (typeof ex !== 'object' || ex === null) return false;
            if (!validNames.has(ex.name)) {
              console.warn(`[generate-weekly-plan] Hallucinated exercise removed: "${ex.name}"`);
              return false;
            }
            return true;
          })
          .map((ex) => {
            let sets = Math.min(5, Math.max(2, Math.round(Number(ex.sets) || 3)));
            if (isDeload) sets = deloadSetCount(sets);
            return { name: ex.name, sets };
          });
      }
    }
    typed.isDeloadWeek = isDeload;

    return new Response(
      JSON.stringify({ plan: typed }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('generate-weekly-plan error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
