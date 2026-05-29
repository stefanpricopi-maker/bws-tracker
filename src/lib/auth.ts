import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEFAULT_USER_ID = 1;
const COOKIE_NAME = 'bws_session';

function authSecret(): string | undefined {
  return process.env.BWS_AUTH_SECRET?.trim() || undefined;
}

export function isAuthEnabled(): boolean {
  return !!authSecret();
}

function sign(userId: number): string {
  const secret = authSecret()!;
  const sig = createHmac('sha256', secret).update(String(userId)).digest('hex').slice(0, 32);
  return `${userId}.${sig}`;
}

function verify(token: string): number | null {
  const secret = authSecret();
  if (!secret) return DEFAULT_USER_ID;

  const [idPart, sig] = token.split('.');
  const userId = Number(idPart);
  if (!Number.isInteger(userId) || userId < 1 || !sig) return null;

  const expected = createHmac('sha256', secret).update(String(userId)).digest('hex').slice(0, 32);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

/** Resolves user id. When auth enabled, requires valid session cookie. */
export async function resolveUserId(request: Request): Promise<number | null> {
  if (!isAuthEnabled()) return DEFAULT_USER_ID;
  const token = parseCookies(request.headers.get('cookie'))[COOKIE_NAME];
  if (!token) return null;
  return verify(token);
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized', message: 'Login required.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function sessionCookieHeader(userId: number): string {
  const token = sign(userId);
  const maxAge = 60 * 60 * 24 * 30;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function verifyLoginPassword(password: string): boolean {
  const expected = process.env.BWS_LOGIN_PASSWORD?.trim();
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    return false;
  }
}
