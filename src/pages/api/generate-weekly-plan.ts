import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import {
  aiError,
  aiJson,
  aiNotConfiguredResponse,
  catchAiRouteError,
  chatCompletion,
  getAiConfig,
  jsonObjectFormat,
  parseLlmJson,
} from '../../lib/aiApi';
import { db } from '../../db';
import { exercises, mesocycles } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { isDeloadWeek, deloadSetCount, weeksElapsed } from '../../lib/periodization';

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

  if (!getAiConfig().apiKey) return aiNotConfiguredResponse();

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
      return aiError(
        'ai_validation',
        'No exercises in the library. Seed or add exercises first.',
        422,
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

    const { baseUrl, model } = getAiConfig();
    const raw = await chatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt(isDeload) },
        { role: 'user',   content: buildUserPrompt(rows, isDeload) },
      ],
      max_tokens: 1200,
      temperature: 0.3,
      ...jsonObjectFormat(baseUrl),
    });

    const plan = parseLlmJson<{
      split_type?: string;
      days?: Array<{ day_name: string; category: string; exercises: Array<{ name: string; sets: number }> }>;
      isDeloadWeek?: boolean;
    }>(raw, 'Weekly plan was not valid JSON.');

    const validNames = new Set(rows.map((r) => r.name));
    if (plan?.days) {
      for (const day of plan.days) {
        if (!Array.isArray(day.exercises)) {
          day.exercises = [];
          continue;
        }
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
    plan.isDeloadWeek = isDeload;

    return aiJson({ plan });
  } catch (err) {
    return catchAiRouteError(err, 'generate-weekly-plan');
  }
};
