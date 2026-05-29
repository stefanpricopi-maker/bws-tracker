import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import {
  aiJson,
  aiNotConfiguredResponse,
  catchAiRouteError,
  chatCompletion,
  getAiConfig,
  jsonObjectFormat,
  parseLlmJson,
} from '../../lib/aiApi';
import { db } from '../../db';
import { userGoals } from '../../db/schema';
import { eq } from 'drizzle-orm';

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

Generate a 4-meal plan for today (Breakfast, Lunch, Snacks between lunch and dinner, Dinner) that hits these macros exactly (+/- 5% margin of error).
Snacks may include protein bars, nuts, fruit, yogurt — allocate a realistic share of daily calories there when it helps hit targets.
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

  if (!getAiConfig().apiKey) return aiNotConfiguredResponse();

  try {
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

    const { baseUrl, model } = getAiConfig();
    const raw = await chatCompletion({
      model,
      messages: [{ role: 'user', content: buildPrompt(targets) }],
      max_tokens: 1200,
      temperature: 0.2,
      ...jsonObjectFormat(baseUrl),
    });

    const parsed = parseLlmJson(raw, 'Macro solver did not return valid JSON.');
    return aiJson({ plan: parsed, targets });
  } catch (err) {
    return catchAiRouteError(err, 'macro-solver');
  }
};
