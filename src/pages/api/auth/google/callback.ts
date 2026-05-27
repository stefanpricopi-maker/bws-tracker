import type { APIRoute } from 'astro';
import { getTokens } from '../../../../lib/googleFit';
import { db } from '../../../../db';
import { googleTokens } from '../../../../db/schema';

const USER_ID = 1; // replaced by real auth in a later phase

export const GET: APIRoute = async ({ url }) => {
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(null, { status: 302, headers: { Location: '/?google_auth=denied' } });
  }

  try {
    const tokens = await getTokens(code);
    if (!tokens.access_token) throw new Error('No access token returned');

    await db.insert(googleTokens).values({
      userId: USER_ID,
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
