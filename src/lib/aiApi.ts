/**
 * Shared OpenAI-compatible chat helpers and uniform JSON error responses for AI routes.
 */

export type AiErrorCode =
  | 'ai_not_configured'
  | 'ai_upstream'
  | 'ai_network'
  | 'ai_parse'
  | 'ai_validation';

export interface AiErrorBody {
  error: string;
  code: AiErrorCode;
  detail?: string;
}

export class AiRouteError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly status: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'AiRouteError';
  }
}

export function getAiConfig() {
  return {
    baseUrl: process.env['AI_API_BASE_URL'] ?? 'https://api.openai.com/v1',
    apiKey:  process.env['AI_API_KEY'],
    model:   process.env['AI_MODEL'] ?? 'gpt-4o',
  };
}

export function aiJson<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function aiError(
  code: AiErrorCode,
  message: string,
  status: number,
  detail?: string,
): Response {
  const body: AiErrorBody = { error: message, code };
  if (detail) body.detail = detail;
  return aiJson(body, status);
}

export function aiNotConfiguredResponse(): Response {
  return aiError(
    'ai_not_configured',
    'AI is not configured. Set AI_API_KEY on the server.',
    503,
  );
}

export function catchAiRouteError(err: unknown, route: string): Response {
  if (err instanceof AiRouteError) {
    console.error(`[${route}] ${err.code}:`, err.message, err.detail ?? '');
    return aiError(err.code, err.message, err.status, err.detail);
  }
  console.error(`[${route}]`, err);
  return aiError('ai_validation', 'An unexpected error occurred.', 500);
}

/** POST /chat/completions; returns assistant message text. */
export async function chatCompletion(body: Record<string, unknown>): Promise<string> {
  const { baseUrl, apiKey } = getAiConfig();
  if (!apiKey) {
    throw new AiRouteError(
      'ai_not_configured',
      'AI is not configured. Set AI_API_KEY on the server.',
      503,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiRouteError(
      'ai_network',
      'Could not reach the AI provider.',
      502,
      String(err),
    );
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 500);
    throw new AiRouteError(
      'ai_upstream',
      `AI provider returned ${res.status}.`,
      502,
      detail || undefined,
    );
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new AiRouteError('ai_parse', 'Empty response from AI provider.', 422);
  }
  return content;
}

/** Parse JSON from LLM output (raw JSON or ```json fenced). */
export function parseLlmJson<T>(raw: string, message = 'Could not parse JSON from AI response.'): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    throw new AiRouteError('ai_parse', message, 422, trimmed.slice(0, 300));
  }
}

export function jsonObjectFormat(baseUrl: string): { response_format: { type: 'json_object' } } | Record<string, never> {
  return baseUrl.includes('anthropic') ? {} : { response_format: { type: 'json_object' } };
}
