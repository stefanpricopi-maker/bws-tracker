import { resolveUserId, unauthorizedResponse } from './auth';
import { checkRateLimit } from './rateLimit';

export async function requireUser(
  request: Request,
  rateLimitRoute?: string,
  maxRequests = 60,
): Promise<{ userId: number } | Response> {
  if (rateLimitRoute) {
    const limited = checkRateLimit(request, rateLimitRoute, maxRequests, 60_000);
    if (limited) return limited;
  }
  const userId = await resolveUserId(request);
  if (userId === null) return unauthorizedResponse();
  return { userId };
}
