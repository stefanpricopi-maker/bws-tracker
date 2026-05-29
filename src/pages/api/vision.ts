import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';

// Expects env vars:
//   AI_API_KEY      — your OpenAI (or compatible) API key
//   AI_API_BASE_URL — base URL, defaults to OpenAI (https://api.openai.com/v1)
//   AI_MODEL        — model to use, defaults to gpt-4o (must support vision)

const BASE_URL  = process.env['AI_API_BASE_URL'] ?? 'https://api.openai.com/v1';
const API_KEY   = process.env['AI_API_KEY'];
const MODEL     = process.env['AI_MODEL'] ?? 'gpt-4o';

const SYSTEM_PROMPT =
  'Analyze this image of a meal or nutrition label. Estimate the total Calories, Protein (g), Carbs (g), and Fat (g). Return strictly a JSON object with keys: calories, protein, carbs, fat.';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, 'vision', 15);
  if (auth instanceof Response) return auth;

  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY is not configured on the server.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: { image?: string; mimeType?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { image, mimeType = 'image/jpeg' } = body;
  if (!image) {
    return new Response(
      JSON.stringify({ error: 'Missing "image" field (base64 string).' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Build OpenAI-compatible vision request
  const payload = {
    model: MODEL,
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
  };

  let aiResponse: Response;
  try {
    aiResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Network error calling AI API: ${err}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!aiResponse.ok) {
    const detail = await aiResponse.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: `AI API returned ${aiResponse.status}`, detail }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const json = await aiResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = json.choices?.[0]?.message?.content ?? '';

  // Extract JSON from the model's reply (may be wrapped in ```json ... ```)
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return new Response(
      JSON.stringify({ error: 'Could not parse JSON from AI response.', raw }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let macros: { calories?: number; protein?: number; carbs?: number; fat?: number };
  try {
    macros = JSON.parse(match[0]);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Malformed JSON in AI response.', raw }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      calories: Math.round(Number(macros.calories) || 0),
      protein:  Math.round(Number(macros.protein)  || 0),
      carbs:    Math.round(Number(macros.carbs)     || 0),
      fat:      Math.round(Number(macros.fat)       || 0),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
