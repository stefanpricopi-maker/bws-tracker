import { ALL_FOOD_IDS, FOOD_CATALOG_IDS, foodLabelById } from './foodCatalog';

export const MIN_ALLOWED_FOODS = 5;
export const MAX_CUSTOM_FOODS = 30;
export const CUSTOM_FOOD_ID_PREFIX = 'custom_';

export interface CustomFoodItem {
  id:    string;
  label: string;
}

export interface MealPreferences {
  allowedIds:  string[];
  customFoods: CustomFoodItem[];
}

/** Default: all catalog foods allowed, no custom items. */
export function defaultMealPreferences(): MealPreferences {
  return {
    allowedIds:  [...ALL_FOOD_IDS],
    customFoods: [],
  };
}

export function isCustomFoodId(id: string): boolean {
  return id.startsWith(CUSTOM_FOOD_ID_PREFIX);
}

export function slugifyFoodLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
}

export function createCustomFoodId(label: string, existingIds: Set<string>): string {
  const base = slugifyFoodLabel(label) || 'item';
  let id = `${CUSTOM_FOOD_ID_PREFIX}${base}`;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${CUSTOM_FOOD_ID_PREFIX}${base}_${n}`;
    n += 1;
  }
  return id;
}

export function normalizeCustomLabel(label: unknown): string | null {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 48) return null;
  return trimmed;
}

/** @deprecated use parseMealPreferencesJson */
export function parseStoredAllowedFoodIds(raw: string | null | undefined): string[] | null {
  const p = parseMealPreferencesJson(raw);
  return p?.allowedIds ?? null;
}

export function parseMealPreferencesJson(raw: string | null | undefined): MealPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;

    // Legacy: plain array of catalog ids
    if (Array.isArray(parsed)) {
      const ids = parsed.filter(
        (id): id is string => typeof id === 'string' && FOOD_CATALOG_IDS.has(id),
      );
      return ids.length > 0 ? { allowedIds: ids, customFoods: [] } : null;
    }

    if (parsed == null || typeof parsed !== 'object') return null;
    const row = parsed as Record<string, unknown>;

    const customFoods = sanitizeCustomFoods(row.customFoods);
    const customIds = new Set(customFoods.map((c) => c.id));

    let allowedIds: string[] = [];
    if (Array.isArray(row.allowedIds)) {
      allowedIds = row.allowedIds.filter(
        (id): id is string =>
          typeof id === 'string' &&
          (FOOD_CATALOG_IDS.has(id) || customIds.has(id)),
      );
    }

    if (allowedIds.length === 0 && customFoods.length === 0) return null;
    return { allowedIds, customFoods };
  } catch {
    return null;
  }
}

function sanitizeCustomFoods(raw: unknown): CustomFoodItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomFoodItem[] = [];
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  for (const item of raw) {
    if (out.length >= MAX_CUSTOM_FOODS) break;
    if (item == null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const label = normalizeCustomLabel(row.label);
    if (!label) continue;
    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) continue;

    let id = typeof row.id === 'string' ? row.id : '';
    if (!id.startsWith(CUSTOM_FOOD_ID_PREFIX) || seenIds.has(id)) {
      id = createCustomFoodId(label, seenIds);
    }
    seenIds.add(id);
    seenLabels.add(labelKey);
    out.push({ id, label });
  }
  return out;
}

export function resolveMealPreferences(stored: MealPreferences | null | undefined): MealPreferences {
  if (!stored) return defaultMealPreferences();

  const customFoods = stored.customFoods ?? [];
  const customIds = new Set(customFoods.map((c) => c.id));

  const allowedFromStored = (stored.allowedIds ?? []).filter(
    (id) => FOOD_CATALOG_IDS.has(id) || customIds.has(id),
  );

  const allowedIds =
    allowedFromStored.length > 0
      ? allowedFromStored
      : [...ALL_FOOD_IDS, ...customFoods.map((c) => c.id)];

  return { allowedIds, customFoods };
}

export function sanitizeMealPreferencesInput(body: unknown): MealPreferences | null {
  if (body == null || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;

  const customFoods = sanitizeCustomFoods(row.customFoods);
  const customIds = new Set(customFoods.map((c) => c.id));

  if (!Array.isArray(row.allowedIds)) return null;
  const allowedIds = [
    ...new Set(
      row.allowedIds.filter(
        (id): id is string =>
          typeof id === 'string' &&
          (FOOD_CATALOG_IDS.has(id) || customIds.has(id)),
      ),
    ),
  ];

  if (allowedIds.length === 0) return null;
  return { allowedIds, customFoods };
}

export function serializeMealPreferences(prefs: MealPreferences): string {
  return JSON.stringify({
    allowedIds:  prefs.allowedIds,
    customFoods: prefs.customFoods,
  });
}

/** @deprecated */
export function sanitizeAllowedFoodIds(ids: unknown): string[] | null {
  const p = sanitizeMealPreferencesInput({ allowedIds: ids, customFoods: [] });
  return p?.allowedIds ?? null;
}

export function resolveAllowedFoodIds(stored: string[] | null | undefined): string[] {
  if (!stored?.length) return defaultMealPreferences().allowedIds;
  return stored.filter((id) => FOOD_CATALOG_IDS.has(id));
}

export function defaultAllowedFoodIds(): string[] {
  return defaultMealPreferences().allowedIds;
}

export function foodLabelForId(id: string, customFoods: CustomFoodItem[]): string | undefined {
  if (FOOD_CATALOG_IDS.has(id)) return foodLabelById(id);
  return customFoods.find((c) => c.id === id)?.label;
}

export function allowedFoodLabels(prefs: MealPreferences): string[] {
  return prefs.allowedIds
    .map((id) => foodLabelForId(id, prefs.customFoods))
    .filter((l): l is string => !!l);
}

export function canGenerateMealPlan(allowedIds: string[]): boolean {
  return allowedIds.length >= MIN_ALLOWED_FOODS;
}

export function addCustomFood(
  prefs: MealPreferences,
  label: string,
): { prefs: MealPreferences; error?: string } {
  const normalized = normalizeCustomLabel(label);
  if (!normalized) {
    return { prefs, error: 'Numele trebuie să aibă între 2 și 48 caractere.' };
  }
  if (prefs.customFoods.length >= MAX_CUSTOM_FOODS) {
    return { prefs, error: `Maximum ${MAX_CUSTOM_FOODS} elemente personalizate.` };
  }
  const dup = prefs.customFoods.some(
    (c) => c.label.toLowerCase() === normalized.toLowerCase(),
  );
  if (dup) {
    return { prefs, error: 'Acest aliment există deja în lista ta.' };
  }

  const existingIds = new Set([
    ...prefs.customFoods.map((c) => c.id),
    ...prefs.allowedIds,
  ]);
  const id = createCustomFoodId(normalized, existingIds);
  const item: CustomFoodItem = { id, label: normalized };

  return {
    prefs: {
      allowedIds:  [...prefs.allowedIds, id],
      customFoods: [...prefs.customFoods, item],
    },
  };
}

export function removeCustomFood(prefs: MealPreferences, id: string): MealPreferences {
  return {
    allowedIds:  prefs.allowedIds.filter((x) => x !== id),
    customFoods: prefs.customFoods.filter((c) => c.id !== id),
  };
}
