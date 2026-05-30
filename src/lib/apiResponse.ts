/** Parse JSON API responses; surface server/HTML failures as readable errors. */
export async function readApiJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok
      ? 'Server returned an empty response.'
      : `Server error (${res.status}). Try again in a moment.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok
      ? 'Server returned an invalid response. Try again.'
      : `Server error (${res.status}). Try again in a moment.`);
  }
}
