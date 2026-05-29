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
import {
  allowedFoodLabels,
  MIN_ALLOWED_FOODS,
  canGenerateMealPlan,
  parseStoredAllowedFoodIds,
  resolveAllowedFoodIds,
} from '../../lib/mealPreferences';
import { buildMacroSolverPrompt } from '../../lib/macroSolverPrompt';

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

    const allowedIds = resolveAllowedFoodIds(
      parseStoredAllowedFoodIds(goals?.mealPreferencesJson ?? null),
    );
    if (!canGenerateMealPlan(allowedIds)) {
      return aiJson(
        { error: `Select at least ${MIN_ALLOWED_FOODS} foods in meal preferences before generating a plan.` },
        400,
      );
    }

    const labels = allowedFoodLabels(allowedIds);
    const { baseUrl, model } = getAiConfig();
    const raw = await chatCompletion({
      model,
      messages: [{ role: 'user', content: buildMacroSolverPrompt(targets, labels) }],
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
