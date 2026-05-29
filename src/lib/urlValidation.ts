/** Validate exercise image URLs (https only, no javascript/data). */

export function validateExerciseImageUrl(
  raw: string | null | undefined,
): { ok: true; url: string | null } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, url: null };

  const url = raw.trim();
  if (url.length > 2048) {
    return { ok: false, error: 'image_url is too long (max 2048 characters).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'image_url must be a valid URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'image_url must use https://' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return { ok: false, error: 'image_url host is not allowed.' };
  }

  return { ok: true, url };
}
