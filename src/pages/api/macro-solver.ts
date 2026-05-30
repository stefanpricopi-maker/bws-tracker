import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { aiJson } from '../../lib/aiApi';
import { db } from '../../db';
import { userGoals } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  MIN_ALLOWED_FOODS,
  canGenerateMealPlan,
  parseMealPreferencesJson,
  resolveMealPreferences,
} from '../../lib/mealPreferences';
import { generateMealPlanFromCatalog } from '../../lib/macroSolverLocal';

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'macro-solver', 10);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

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

    const prefs = resolveMealPreferences(
      parseMealPreferencesJson(goals?.mealPreferencesJson ?? null),
    );
    if (!canGenerateMealPlan(prefs.allowedIds)) {
      return aiJson(
        { error: `Selectează cel puțin ${MIN_ALLOWED_FOODS} alimente în preferințe.` },
        400,
      );
    }

    const catalogIds = prefs.allowedIds.filter((id) => !id.startsWith('custom_'));
    const plan = generateMealPlanFromCatalog(targets, catalogIds);
    return aiJson({ plan, targets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nu am putut genera planul.';
    return aiJson({ error: message }, 422);
  }
};
