import type { APIRoute } from 'astro';
import { resolveUserId, DEFAULT_USER_ID } from '../../../../lib/auth';
import { getTokens } from '../../../../lib/googleFit';
import { db } from '../../../../db';
import { googleTokens } from '../../../../db/schema';

export const GET: APIRoute = async ({ request, url }) => {
  const userId = (await resolveUserId(request)) ?? DEFAULT_USER_ID;
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    console.error('Google OAuth error:', error ?? 'no_code', url.toString());
    return new Response(null, { status: 302, headers: { Location: '/?google_auth=denied' } });
  }

  try {
    const tokens = await getTokens(code);
    if (!tokens.access_token) throw new Error('No access token returned');

    await db.insert(googleTokens).values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
    }).onConflictDoUpdate({
      target: googleTokens.userId,
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date ?? null,
        updatedAt: new Date().toISOString(),
      },
    });

    return new Response(null, { status: 302, headers: { Location: '/?google_auth=success' } });
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return new Response(null, { status: 302, headers: { Location: '/?google_auth=error' } });
  }
};
