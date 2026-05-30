/**
 * Meal macro estimation via USDA FoodData Central (free, government data).
 * https://fdc.nal.usda.gov/api-guide
 */

import { AiRouteError } from './aiApi';
import { normalizeMealMacros, type MealMacrosEstimate } from './mealMacrosAi';
import { parseLocaleNumber } from './parseLocaleNumber';

export function getFdcConfig() {
  return { apiKey: process.env['FDC_API_KEY'] };
}

export function isFdcConfigured(): boolean {
  return Boolean(getFdcConfig().apiKey);
}

/** Split textarea into ingredient lines. */
export function parseMealDescriptionToIngredients(description: string): string[] {
  const parts = description
    .split(/\n+/)
    .flatMap((line) => line.split(/[,;•]+/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  return parts.length > 0 ? parts : [description.trim()];
}

const RO_UNITS: [RegExp, string][] = [
  [/\blingur[aăi]?\s*(de\s+)?/gi, 'tbsp '],
  [/\bte linguri?\s*(de\s+)?/gi, 'tbsp '],
  [/\bteaspoons?\b/gi, 'tsp'],
];

const RO_FOOD_TERMS: [RegExp, string][] = [
  [/fulgi\s+de\s+ov[aă]z/gi, 'oats'],
  [/\bov[aă]z\b/gi, 'oats'],
  [/\bcurmale\b/gi, 'dates'],
  [/\blapte\b/gi, 'milk'],
  [/\bbanan[aă]\b/gi, 'banana'],
  [/\bou[aă]\b/gi, 'eggs'],
  [/\bp[aâ]ine\b/gi, 'bread'],
  [/\biaurt\b/gi, 'yogurt'],
  [/\bnuci\b/gi, 'walnuts'],
  [/\bpeanut\s+butter\b/gi, 'peanut butter'],
  [/\bunt\s+de\s+arachide\b/gi, 'peanut butter'],
  [/\bpiept\s+de\s+pui\b/gi, 'chicken breast'],
  [/\borez\b/gi, 'rice'],
  [/\bpaste\b/gi, 'pasta'],
  [/\bcartofi\b/gi, 'potatoes'],
  [/\bsomon\b/gi, 'salmon'],
  [/\bton\b/gi, 'tuna'],
];

/** Normalize Romanian ingredient lines for USDA search. */
export function normalizeIngredientForApi(line: string): string {
  let s = line.trim();
  for (const [re, rep] of RO_FOOD_TERMS) s = s.replace(re, rep);
  for (const [re, rep] of RO_UNITS) s = s.replace(re, rep);
  s = s.replace(/\bo\b/gi, '1');
  s = s.replace(/\b(un|una|unui|unei)\b/gi, '1');
  return s.trim();
}

export interface ParsedIngredient {
  query: string;
  grams: number;
}

const DEFAULT_UNIT_GRAMS: Record<string, number> = {
  banana:       118,
  dates:        7,
  date:         7,
  egg:          50,
  eggs:         50,
};

function defaultUnitGrams(query: string): number | null {
  const q = query.toLowerCase();
  for (const [key, grams] of Object.entries(DEFAULT_UNIT_GRAMS)) {
    if (q.includes(key)) return grams;
  }
  return null;
}

function gramsPerTbsp(query: string): number {
  return /peanut\s+butter/i.test(query) ? 16 : 15;
}

function readQuantity(raw: string): number {
  return parseLocaleNumber(raw) ?? 0;
}

/** Parse quantity + food name from one ingredient line. */
export function parseIngredientQuantity(line: string): ParsedIngredient {
  const normalized = normalizeIngredientForApi(line);

  const startG = normalized.match(/^(\d+(?:[.,]\d+)?)\s*g\b\s*(.+)$/i);
  if (startG) {
    return { query: startG[2].trim(), grams: readQuantity(startG[1]) };
  }

  const endG = normalized.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*g\b$/i);
  if (endG) {
    return { query: endG[1].trim(), grams: readQuantity(endG[2]) };
  }

  const startMl = normalized.match(/^(\d+(?:[.,]\d+)?)\s*ml\b\s*(.+)$/i);
  if (startMl) {
    return { query: startMl[2].trim(), grams: readQuantity(startMl[1]) };
  }

  const endMl = normalized.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*ml\b$/i);
  if (endMl) {
    return { query: endMl[1].trim(), grams: readQuantity(endMl[2]) };
  }

  const tbsp = normalized.match(/^(\d+(?:[.,]\d+)?)\s*tbsp\b\s*(.+)$/i);
  if (tbsp) {
    const query = tbsp[2].trim();
    return { query, grams: readQuantity(tbsp[1]) * gramsPerTbsp(query) };
  }

  const countLeading = normalized.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (countLeading) {
    const query = countLeading[2].trim();
    const unit = defaultUnitGrams(query);
    if (unit) return { query, grams: readQuantity(countLeading[1]) * unit };
  }

  const oneItem = normalized.match(/^1\s+(.+)$/);
  if (oneItem) {
    const query = oneItem[1].trim();
    const unit = defaultUnitGrams(query);
    if (unit) return { query, grams: unit };
  }

  return { query: normalized, grams: 100 };
}

interface FdcNutrient {
  nutrientId?: number;
  nutrientNumber?: number;
  value?: number;
}

export interface FdcFood {
  fdcId?: number;
  description?: string;
  foodNutrients?: FdcNutrient[];
}

interface RawMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const NUTRIENT_IDS = {
  calories: [1008, 2047, 2048],
  protein:  [1003],
  fat:      [1004],
  carbs:    [1005],
} as const;

function nutrientValue(nutrients: FdcNutrient[], ids: readonly number[]): number {
  for (const id of ids) {
    const hit = nutrients.find(
      (n) => n.nutrientId === id || n.nutrientNumber === id,
    );
    if (typeof hit?.value === 'number' && Number.isFinite(hit.value)) return hit.value;
  }
  return 0;
}

/** Extract per-100g macros from a USDA search hit. */
export function extractPer100gMacros(food: FdcFood): RawMacros {
  const nutrients = food.foodNutrients ?? [];
  return {
    calories: nutrientValue(nutrients, NUTRIENT_IDS.calories),
    protein:  nutrientValue(nutrients, NUTRIENT_IDS.protein),
    carbs:    nutrientValue(nutrients, NUTRIENT_IDS.carbs),
    fat:      nutrientValue(nutrients, NUTRIENT_IDS.fat),
  };
}

export function scaleMacros(per100: RawMacros, grams: number): RawMacros {
  const factor = grams / 100;
  return {
    calories: per100.calories * factor,
    protein:  per100.protein  * factor,
    carbs:    per100.carbs    * factor,
    fat:      per100.fat      * factor,
  };
}

export function sumMacros(parts: RawMacros[]): MealMacrosEstimate {
  const total = parts.reduce<RawMacros>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein:  acc.protein  + m.protein,
      carbs:    acc.carbs    + m.carbs,
      fat:      acc.fat      + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return normalizeMealMacros(total);
}

async function searchUsdaFood(query: string, apiKey: string): Promise<FdcFood | null> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString(), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      query,
      pageSize: 1,
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
    }),
  });

  if (!res.ok) return null;

  const data = await res.json().catch(() => null) as { foods?: FdcFood[] } | null;
  return data?.foods?.[0] ?? null;
}

export async function estimateMealFromNutritionApi(
  description: string,
): Promise<MealMacrosEstimate> {
  const { apiKey } = getFdcConfig();
  if (!apiKey) {
    throw new AiRouteError(
      'ai_not_configured',
      'API nutriție neconfigurat. Setează FDC_API_KEY (gratuit pe fdc.nal.usda.gov).',
      503,
    );
  }

  const lines = parseMealDescriptionToIngredients(description);
  if (lines.length === 0) {
    throw new AiRouteError('ai_validation', 'Descrie ce ai mâncat (min. un ingredient).', 400);
  }

  const scaled: RawMacros[] = [];
  const missing: string[] = [];

  for (const line of lines) {
    const parsed = parseIngredientQuantity(line);
    if (!parsed.query || parsed.grams <= 0) {
      missing.push(line);
      continue;
    }

    let food: FdcFood | null;
    try {
      food = await searchUsdaFood(parsed.query, apiKey);
    } catch (err) {
      throw new AiRouteError(
        'ai_network',
        'Nu m-am putut conecta la baza USDA FoodData Central.',
        502,
        err instanceof Error ? err.message : undefined,
      );
    }

    if (!food) {
      missing.push(line);
      continue;
    }

    const per100 = extractPer100gMacros(food);
    if (per100.calories === 0 && per100.protein === 0 && per100.carbs === 0 && per100.fat === 0) {
      missing.push(line);
      continue;
    }

    scaled.push(scaleMacros(per100, parsed.grams));
  }

  if (scaled.length === 0) {
    throw new AiRouteError(
      'ai_validation',
      missing.length > 0
        ? `Nu am găsit: ${missing.slice(0, 3).join(', ')}. Încearcă cantități explicite (ex. „200g ovăz”).`
        : 'Nu am putut calcula macro-urile.',
      422,
    );
  }

  const macros = sumMacros(scaled);
  if (macros.calories === 0) {
    throw new AiRouteError(
      'ai_validation',
      'Nu am putut calcula macro-urile. Verifică cantitățile (ex. „200g ovăz”, „200 ml lapte”).',
      422,
    );
  }

  return macros;
}

export function nutritionNotConfiguredResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'API nutriție neconfigurat. Setează FDC_API_KEY (gratuit: fdc.nal.usda.gov/api-key-sign.html).',
      code:  'ai_not_configured',
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}
