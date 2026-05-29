import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/apiAuth';
import { fetchDailyMetrics } from '../../../lib/googleFit';
import { withRefreshedGoogleClient } from '../../../lib/googleTokenStore';

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    const refreshed = await withRefreshedGoogleClient(userId);
    if (!refreshed.stored) {
      return new Response(
        JSON.stringify({ error: 'not_connected', message: 'Google Fit not connected. Connect in Profile.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = refreshed.accessToken ?? refreshed.stored.accessToken;
    const metrics = await fetchDailyMetrics(
      accessToken,
      refreshed.stored.refreshToken,
      date,
    );

    return new Response(JSON.stringify({ ...metrics, tokenRefreshed: accessToken !== refreshed.stored.accessToken }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsReauth = message.includes('invalid_grant') || message.includes('Token has been expired');
    return new Response(
      JSON.stringify({
        error: needsReauth ? 'token_expired' : 'fetch_failed',
        message: needsReauth
          ? 'Google Fit session expired. Reconnect in Profile → Google Fit.'
          : message,
      }),
      { status: needsReauth ? 401 : 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
