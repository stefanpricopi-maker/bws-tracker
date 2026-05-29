import { eq } from 'drizzle-orm';
import { db } from '../db';
import { googleTokens } from '../db/schema';
import { createOAuth2Client } from './googleFit';

export async function getGoogleTokens(userId: number) {
  const [stored] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);
  return stored ?? null;
}

/** Refresh access token if needed; persist new credentials to DB. */
export async function withRefreshedGoogleClient(userId: number) {
  const stored = await getGoogleTokens(userId);
  if (!stored) return { stored: null, client: null };

  const client = createOAuth2Client();
  client.setCredentials({
    access_token:  stored.accessToken,
    refresh_token: stored.refreshToken ?? undefined,
    expiry_date:   stored.expiryDate ?? undefined,
  });

  const tokenRes = await client.getAccessToken();
  const creds = client.credentials;

  if (creds.access_token && creds.access_token !== stored.accessToken) {
    const now = new Date().toISOString();
    await db
      .update(googleTokens)
      .set({
        accessToken: creds.access_token,
        expiryDate:  creds.expiry_date ?? stored.expiryDate,
        updatedAt:   now,
      })
      .where(eq(googleTokens.userId, userId));
  }

  return { stored, client, accessToken: tokenRes.token ?? creds.access_token };
}
