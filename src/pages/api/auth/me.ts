import type { APIRoute } from 'astro';
import { resolveUserId, isAuthEnabled, unauthorizedResponse } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const userId = await resolveUserId(request);
  if (userId === null) return unauthorizedResponse();
  return new Response(
    JSON.stringify({ userId, authEnabled: isAuthEnabled() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
