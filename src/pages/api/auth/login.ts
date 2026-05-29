import type { APIRoute } from 'astro';
import { db } from '../../../db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import {
  isAuthEnabled,
  verifyLoginPassword,
  sessionCookieHeader,
  DEFAULT_USER_ID,
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthEnabled()) {
    return new Response(
      JSON.stringify({ error: 'auth_disabled', message: 'Set BWS_AUTH_SECRET and BWS_LOGIN_PASSWORD to enable login.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const body = await request.json() as { password?: string };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!verifyLoginPassword(password)) {
    return new Response(JSON.stringify({ error: 'invalid_password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [user] = await db.select().from(users).where(eq(users.id, DEFAULT_USER_ID)).limit(1);
  if (!user) {
    await db.insert(users).values({ id: DEFAULT_USER_ID, name: 'Athlete' }).onConflictDoNothing();
  }

  return new Response(JSON.stringify({ ok: true, userId: DEFAULT_USER_ID }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(DEFAULT_USER_ID),
    },
  });
};
