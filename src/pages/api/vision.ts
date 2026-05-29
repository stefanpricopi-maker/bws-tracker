import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import {
  aiError,
  aiJson,
  aiNotConfiguredResponse,
  catchAiRouteError,
  chatCompletion,
  getAiConfig,
  parseLlmJson,
} from '../../lib/aiApi';

const SYSTEM_PROMPT =
  'Analyze this image of a meal or nutrition label. Estimate the total Calories, Protein (g), Carbs (g), and Fat (g). Return strictly a JSON object with keys: calories, protein, carbs, fat.';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'vision', 15);
  if (auth instanceof Response) return auth;

  if (!getAiConfig().apiKey) return aiNotConfiguredResponse();

  let body: { image?: string; mimeType?: string };
  try {
    body = await request.json();
  } catch {
    return aiError('ai_validation', 'Invalid JSON body.', 400);
  }

  const { image, mimeType = 'image/jpeg' } = body;
  if (!image) {
    return aiError('ai_validation', 'Missing "image" field (base64 string).', 400);
  }

  try {
    const { model } = getAiConfig();
    const raw = await chatCompletion({
      model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SYSTEM_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${image}`, detail: 'low' },
            },
          ],
        },
      ],
    });

    const macros = parseLlmJson<{
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    }>(raw, 'Could not parse macros from AI response.');

    return aiJson({
      calories: Math.round(Number(macros.calories) || 0),
      protein:  Math.round(Number(macros.protein)  || 0),
      carbs:    Math.round(Number(macros.carbs)     || 0),
      fat:      Math.round(Number(macros.fat)       || 0),
    });
  } catch (err) {
    return catchAiRouteError(err, 'vision');
  }
};
