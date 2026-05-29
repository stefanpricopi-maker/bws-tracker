const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientKey(request: Request, route: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip') || 'local';
  return `${route}:${ip}`;
}

/**
 * Returns a 429 Response if limit exceeded, otherwise null.
 */
export function checkRateLimit(
  request: Request,
  route: string,
  maxRequests = 60,
  windowMs = 60_000,
): Response | null {
  const key = clientKey(request, route);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > maxRequests) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Try again shortly.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return null;
}
