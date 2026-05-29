import { describe, expect, it } from 'vitest';
import { aiError, parseLlmJson, AiRouteError } from './aiApi';

describe('aiApi', () => {
  it('aiError returns uniform JSON shape', async () => {
    const res = aiError('ai_upstream', 'Provider failed', 502, 'rate limit');
    const body = await res.json() as { error: string; code: string; detail?: string };
    expect(res.status).toBe(502);
    expect(body).toEqual({
      error: 'Provider failed',
      code: 'ai_upstream',
      detail: 'rate limit',
    });
  });

  it('parseLlmJson extracts fenced JSON', () => {
    const obj = parseLlmJson<{ a: number }>('Here you go:\n```json\n{"a":1}\n```');
    expect(obj.a).toBe(1);
  });

  it('parseLlmJson throws AiRouteError on garbage', () => {
    expect(() => parseLlmJson('not json')).toThrow(AiRouteError);
  });
});
