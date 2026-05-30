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
import {
  buildMealEstimatePrompt,
  normalizeMealMacros,
  validateMealDescription,
} from '../../lib/mealMacrosAi';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'meal-estimate', 20);
  if (auth instanceof Response) return auth;

  if (!getAiConfig().apiKey) return aiNotConfiguredResponse();

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

  const mealLabel =
    typeof body.meal === 'string' && body.meal.trim().length > 0
      ? body.meal.trim().slice(0, 40)
      : undefined;

  try {
    const { baseUrl, model } = getAiConfig();
    const raw = await chatCompletion({
      model,
      max_tokens: 256,
      temperature: 0.2,
      messages: [{ role: 'user', content: buildMealEstimatePrompt(description, mealLabel) }],
      ...jsonObjectFormat(baseUrl),
    });

    const parsed = parseLlmJson<{
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    }>(raw, 'Could not parse macros from AI response.');

    return aiJson(normalizeMealMacros(parsed));
  } catch (err) {
    return catchAiRouteError(err, 'meal-estimate');
  }
};
