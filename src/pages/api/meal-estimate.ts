import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { aiError, aiJson, catchAiRouteError } from '../../lib/aiApi';
import { validateMealDescription } from '../../lib/mealMacrosAi';
import {
  estimateMealFromNutritionApi,
  isFdcConfigured,
  nutritionNotConfiguredResponse,
} from '../../lib/nutritionApi';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'meal-estimate', 20);
  if (auth instanceof Response) return auth;

  if (!isFdcConfigured()) return nutritionNotConfiguredResponse();

  let body: { description?: string; meal?: string };
  try {
    body = await request.json();
  } catch {
    return aiError('ai_validation', 'Invalid JSON body.', 400);
  }

  const description = validateMealDescription(body.description);
  if (!description) {
    return aiError(
      'ai_validation',
      'Descrie ce ai mâncat (3–500 caractere).',
      400,
    );
  }

  try {
    const macros = await estimateMealFromNutritionApi(description);
    return aiJson(macros);
  } catch (err) {
    return catchAiRouteError(err, 'meal-estimate');
  }
};
