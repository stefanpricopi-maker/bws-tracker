import type { APIRoute } from 'astro';
import { fetchDailyMetrics } from '../../../lib/googleFit';
import { db } from '../../../db';
import { googleTokens } from '../../../db/schema';
import { eq } from 'drizzle-orm';

const USER_ID = 1;

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    // Load stored tokens for user
    const [stored] = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, USER_ID))
      .limit(1);

    if (!stored) {
      return new Response(
        JSON.stringify({ error: 'not_connected', message: 'Google Fit not connected. Tap to connect.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const metrics = await fetchDailyMetrics(stored.accessToken, stored.refreshToken, date);
    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsReauth = message.includes('invalid_grant') || message.includes('Token has been expired');
    return new Response(
      JSON.stringify({ error: needsReauth ? 'token_expired' : 'fetch_failed', message }),
      { status: needsReauth ? 401 : 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
