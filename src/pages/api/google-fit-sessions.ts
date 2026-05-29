import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { fetchWorkoutSessions } from '../../lib/googleFit';
import { db } from '../../db';
import { googleTokens } from '../../db/schema';
import { eq } from 'drizzle-orm';


export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  // Accept ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (endDate optional)
  const startDate = url.searchParams.get('startDate')
    ?? new Date().toISOString().slice(0, 10);
  const endDate = url.searchParams.get('endDate') ?? undefined;

  try {
    const [stored] = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, userId))
      .limit(1);

    if (!stored) {
      return new Response(
        JSON.stringify({ error: 'not_connected', message: 'Google Fit not connected.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const sessions = await fetchWorkoutSessions(
      stored.accessToken,
      stored.refreshToken,
      startDate,
      endDate,
    );
    return new Response(JSON.stringify(sessions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('google-fit-sessions error:', err);
    return new Response(
      JSON.stringify({ error: 'fetch_failed', message: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
