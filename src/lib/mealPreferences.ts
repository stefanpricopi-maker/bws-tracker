import { ALL_FOOD_IDS, FOOD_CATALOG_IDS, foodLabelById } from './foodCatalog';

export const MIN_ALLOWED_FOODS = 5;

/** Default: all catalog foods allowed. */
export function defaultAllowedFoodIds(): string[] {
  return [...ALL_FOOD_IDS];
}

export function parseStoredAllowedFoodIds(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter((id): id is string => typeof id === 'string' && FOOD_CATALOG_IDS.has(id));
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function resolveAllowedFoodIds(stored: string[] | null | undefined): string[] {
  if (stored && stored.length > 0) return stored.filter((id) => FOOD_CATALOG_IDS.has(id));
  return defaultAllowedFoodIds();
}

export function sanitizeAllowedFoodIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  const clean = [...new Set(ids.filter((id): id is string => typeof id === 'string' && FOOD_CATALOG_IDS.has(id)))];
  return clean.length > 0 ? clean : null;
}

export function allowedFoodLabels(ids: string[]): string[] {
  return ids.map((id) => foodLabelById(id)).filter((l): l is string => !!l);
}

export function canGenerateMealPlan(allowedIds: string[]): boolean {
  return allowedIds.length >= MIN_ALLOWED_FOODS;
}
