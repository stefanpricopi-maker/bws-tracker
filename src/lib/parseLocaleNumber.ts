/** Parse numbers typed with comma or dot (e.g. Romanian 92,9). */
export function parseLocaleNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value).trim().replace(/\s/g, '');
  if (!raw) return null;

  // Keep digits, one decimal separator (comma or dot), optional leading minus
  const normalized = raw.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
