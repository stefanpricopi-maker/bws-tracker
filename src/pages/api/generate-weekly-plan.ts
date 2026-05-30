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
import { isDeloadWeek, weeksElapsed } from '../../lib/periodization';
import { normalizeWeeklyPlan, WEEKLY_SCHEDULE } from '../../lib/weeklyPlan';

function systemPrompt(isDeload: boolean): string {
  const volumeNote = isDeload
    ? `\nIMPORTANT: This is MESOCYCLE DELOAD WEEK. Reduce every exercise to ~60% of normal sets (e.g. 3→2, 4→2). Keep the same exercises.`
    : '';
  const scheduleLines = WEEKLY_SCHEDULE.map(
    (d) => `- ${d.day_name}: ${d.isRest ? 'Rest (empty exercises)' : d.category}`,
  ).join('\n');
  return `You are a strict Built With Science fitness coach.
Your job is to create a personalised weekly workout split for a home-gym athlete (dumbbells and resistance bands only).
You will be given the user's full exercise library as a JSON array.
You MUST only use exercise names that appear EXACTLY in the provided list — do not invent, rename, or paraphrase any exercise.
Apply proper volume balance: Push days hit chest/shoulders/triceps, Pull days hit back/biceps/rear-delts, Leg days hit quads/hamstrings/calves, Upper days blend push/pull upper body, Legs+Arms days hit legs plus biceps/triceps/rear delts.

Volume rules (apply per exercise):
- Primary compound (first exercise per day): 4 sets
- Secondary compound: 3 sets
- Isolation for large muscles (back, chest, quads, hamstrings): 3 sets
- Isolation for small muscles (biceps, triceps, rear delts, calves, lateral delts): 2-3 sets
- Total weekly sets per muscle group must stay between 10-20 (hypertrophy range).${volumeNote}

Return ONLY a valid JSON object with NO markdown, NO backticks, NO explanation. The schema:
{
  "split_type": "7-day",
  "days": [
    {
      "day_name": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "category": "Push" | "Pull" | "Legs" | "Upper" | "Legs+Arms" | "Rest",
      "exercises": [
        { "name": "string", "sets": number }
      ]
    }
  ]
}
You MUST return exactly 7 days in calendar order (Monday through Sunday) using this fixed schedule:
${scheduleLines}
Each training day must have 5-7 exercises. Rest days (Wednesday, Sunday) must have category "Rest" and an empty "exercises" array.`;
}

function buildUserPrompt(
  exerciseList: Array<{ name: string; category: string; targetMuscle: string }>,
  isDeload: boolean,
): string {
  const deload = isDeload ? ' This is deload week — use fewer sets per exercise.' : '';
  return `Here is the user's full exercise library:
${JSON.stringify(exerciseList, null, 2)}

Create a balanced 7-day calendar split using ONLY the exercises in this list.
Train on Monday (Push), Tuesday (Pull), Thursday (Legs), Friday (Upper), and Saturday (Legs+Arms).
Wednesday and Sunday are mandatory rest days with no exercises.
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
      max_tokens: 2000,
      temperature: 0.3,
      ...jsonObjectFormat(baseUrl),
    });

    const planRaw = parseLlmJson<{ days?: Array<{ day_name: string; category: string; exercises: Array<{ name: string; sets: number }> }> }>(
      raw,
      'Weekly plan was not valid JSON.',
    );

    const validNames = new Set(rows.map((r) => r.name));
    const plan = normalizeWeeklyPlan(planRaw, validNames, isDeload);

    return aiJson({ plan });
  } catch (err) {
    return catchAiRouteError(err, 'generate-weekly-plan');
  }
};
