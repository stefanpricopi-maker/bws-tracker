/**
 * Curated nutrition database (per 100g / 100ml) for meal logging.
 * Values from USDA FoodData Central — no API guessing at log time.
 */

import { FOOD_CATALOG, type FoodCategory } from './foodCatalog';
import { normalizeMealMacros, type MealMacros } from './mealIntake';

export interface FoodNutritionEntry {
  id:       string;
  label:    string;
  category: FoodCategory;
  per100: {
    calories: number;
    protein:  number;
    carbs:    number;
    fat:      number;
  };
  aliases?:     string[];
  pieceGrams?:  number;
  isLiquid?:    boolean;
  tbspGrams?:   number;
}

export type FoodAmountUnit = 'g' | 'ml' | 'buc' | 'lingura';

export const FOOD_AMOUNT_UNIT_LABELS: Record<FoodAmountUnit, string> = {
  g:       'g',
  ml:      'ml',
  buc:     'buc',
  lingura: 'lingură',
};

type NutritionSeed = Omit<FoodNutritionEntry, 'id' | 'label' | 'category'>;

const NUTRITION_BY_ID: Record<string, NutritionSeed> = {
  chicken_breast: { per100: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } },
  chicken_thigh:  { per100: { calories: 177, protein: 24, carbs: 0, fat: 8 } },
  turkey:         { per100: { calories: 135, protein: 30, carbs: 0, fat: 1 } },
  beef_lean:      { per100: { calories: 250, protein: 26, carbs: 0, fat: 15 } },
  pork_loin:      { per100: { calories: 143, protein: 26, carbs: 0, fat: 3.5 } },
  salmon:         { per100: { calories: 208, protein: 20, carbs: 0, fat: 13 } },
  tuna:           { per100: { calories: 116, protein: 26, carbs: 0, fat: 0.8 } },
  cod:            { per100: { calories: 82, protein: 18, carbs: 0, fat: 0.7 } },
  shrimp:         { per100: { calories: 99, protein: 24, carbs: 0, fat: 0.3 } },
  eggs:           { per100: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, pieceGrams: 50, aliases: ['ou', 'oua'] },
  egg_whites:     { per100: { calories: 52, protein: 11, carbs: 0.7, fat: 0.2 }, pieceGrams: 33, aliases: ['albus'] },
  tofu:           { per100: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 } },
  whey:           { per100: { calories: 400, protein: 80, carbs: 10, fat: 5 }, aliases: ['proteina', 'whey'] },
  greek_yogurt:   { per100: { calories: 97, protein: 9, carbs: 3.6, fat: 5 }, aliases: ['iaurt grecesc'] },
  cottage_cheese: { per100: { calories: 98, protein: 11, carbs: 3.4, fat: 4.3 }, aliases: ['branza cottage'] },
  telemea:        { per100: { calories: 260, protein: 18, carbs: 2, fat: 20 } },
  mozzarella:     { per100: { calories: 280, protein: 22, carbs: 2, fat: 22 } },
  milk_skim:      { per100: { calories: 34, protein: 3.4, carbs: 5, fat: 0.1 }, isLiquid: true, aliases: ['lapte degresat'] },
  milk_whole:     { per100: { calories: 61, protein: 3.3, carbs: 4.8, fat: 3.2 }, isLiquid: true, aliases: ['lapte', 'lapte integral'] },
  rice_white:     { per100: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 }, aliases: ['orez alb'] },
  rice_brown:     { per100: { calories: 111, protein: 2.6, carbs: 23, fat: 0.9 }, aliases: ['orez brun'] },
  pasta:          { per100: { calories: 131, protein: 5, carbs: 25, fat: 1.1 }, aliases: ['paste'] },
  potato:         { per100: { calories: 77, protein: 2, carbs: 17, fat: 0.1 }, aliases: ['cartofi'] },
  sweet_potato:   { per100: { calories: 86, protein: 1.6, carbs: 20, fat: 0.1 }, aliases: ['cartofi dulci'] },
  bread_whole:    { per100: { calories: 247, protein: 13, carbs: 41, fat: 3.4 }, aliases: ['paine integrala', 'paine'] },
  oats:           { per100: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 }, aliases: ['ovaz', 'ovăz', 'fulgi ovaz', 'fulgi de ovaz'] },
  quinoa:         { per100: { calories: 120, protein: 4.4, carbs: 21, fat: 1.9 } },
  tortilla:       { per100: { calories: 218, protein: 5.7, carbs: 45, fat: 2.9 }, aliases: ['lipii'] },
  couscous:       { per100: { calories: 112, protein: 3.8, carbs: 23, fat: 0.2 } },
  broccoli:       { per100: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 } },
  spinach:        { per100: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 }, aliases: ['spanac'] },
  salad_mix:      { per100: { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2 }, aliases: ['salata'] },
  tomato:         { per100: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 }, aliases: ['rosii'] },
  cucumber:       { per100: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 }, aliases: ['castraveti'] },
  pepper:         { per100: { calories: 31, protein: 1, carbs: 6, fat: 0.3 }, aliases: ['ardei'] },
  mushrooms:      { per100: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 }, aliases: ['ciuperci'] },
  zucchini:       { per100: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 }, aliases: ['dovlecel'] },
  green_beans:    { per100: { calories: 31, protein: 1.8, carbs: 7, fat: 0.1 }, aliases: ['fasole verde'] },
  carrot:         { per100: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2 }, aliases: ['morcov'] },
  olive_oil:      { per100: { calories: 884, protein: 0, carbs: 0, fat: 100 }, isLiquid: true, tbspGrams: 14, aliases: ['ulei masline'] },
  avocado:        { per100: { calories: 160, protein: 2, carbs: 8.5, fat: 15 }, pieceGrams: 150 },
  almonds:        { per100: { calories: 579, protein: 21, carbs: 22, fat: 50 }, aliases: ['migdale'] },
  walnuts:        { per100: { calories: 654, protein: 15, carbs: 14, fat: 65 }, aliases: ['nuci'] },
  peanut_butter:  { per100: { calories: 598, protein: 22.2, carbs: 22.3, fat: 51.4 }, tbspGrams: 16, aliases: ['unt arahide', 'unt de arahide', 'peanut butter'] },
  peanuts:        { per100: { calories: 567, protein: 26, carbs: 16, fat: 49 }, aliases: ['arahide'] },
  protein_bar:    { per100: { calories: 400, protein: 40, carbs: 35, fat: 12 }, aliases: ['bara proteica'] },
  banana:         { per100: { calories: 97, protein: 0.7, carbs: 22.7, fat: 0.3 }, pieceGrams: 118, aliases: ['banana', 'banane'] },
  dates:          { per100: { calories: 282, protein: 2.5, carbs: 75, fat: 0.4 }, pieceGrams: 7, aliases: ['curmale', 'curmala'] },
  apple:          { per100: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 }, pieceGrams: 182, aliases: ['mar', 'mere'] },
  berries:        { per100: { calories: 57, protein: 0.7, carbs: 14, fat: 0.3 }, aliases: ['fructe de padure'] },
  hummus:         { per100: { calories: 166, protein: 8, carbs: 14, fat: 10 } },
  rice_cakes:     { per100: { calories: 387, protein: 8, carbs: 85, fat: 2.8 }, aliases: ['vafe orez'] },
  dark_chocolate: { per100: { calories: 598, protein: 7.8, carbs: 46, fat: 43 }, aliases: ['ciocolata neagra'] },
};

export const FOOD_NUTRITION: FoodNutritionEntry[] = FOOD_CATALOG
  .filter((item) => NUTRITION_BY_ID[item.id])
  .map((item) => ({
    id:       item.id,
    label:    item.label,
    category: item.category,
    ...NUTRITION_BY_ID[item.id],
  }));

const FOOD_BY_ID = new Map(FOOD_NUTRITION.map((f) => [f.id, f]));

export function getFoodNutrition(id: string): FoodNutritionEntry | undefined {
  return FOOD_BY_ID.get(id);
}

export function normalizeFoodSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function searchScore(query: string, food: FoodNutritionEntry): number {
  const label = normalizeFoodSearch(food.label);
  const id = normalizeFoodSearch(food.id.replace(/_/g, ' '));

  for (const alias of food.aliases ?? []) {
    const a = normalizeFoodSearch(alias);
    if (a === query) return 150;
    if (a.startsWith(query)) return 95;
    if (a.includes(query)) return 75;
  }

  if (label === query) return 140;
  if (label.startsWith(query)) return 85;
  if (label.includes(query)) return 65;
  if (id.includes(query)) return 55;
  return 0;
}

/** Search predefined foods by Romanian/English label or alias. */
export function searchFoodNutrition(query: string, limit = 8): FoodNutritionEntry[] {
  const q = normalizeFoodSearch(query);
  if (q.length < 1) return FOOD_NUTRITION.slice(0, limit);

  return FOOD_NUTRITION
    .map((food) => ({ food, score: searchScore(q, food) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.food.label.localeCompare(b.food.label, 'ro'))
    .slice(0, limit)
    .map(({ food }) => food);
}

export function availableUnitsForFood(food: FoodNutritionEntry): FoodAmountUnit[] {
  const units: FoodAmountUnit[] = ['g'];
  if (food.isLiquid) units.push('ml');
  if (food.pieceGrams) units.push('buc');
  if (food.tbspGrams) units.push('lingura');
  return units;
}

export function defaultUnitForFood(food: FoodNutritionEntry): FoodAmountUnit {
  if (food.pieceGrams && !food.isLiquid && food.category === 'snacks') return 'buc';
  if (food.tbspGrams && food.category === 'fats') return 'lingura';
  if (food.isLiquid) return 'ml';
  return 'g';
}

export function defaultAmountForFood(food: FoodNutritionEntry, unit: FoodAmountUnit): number {
  if (unit === 'buc') return 1;
  if (unit === 'lingura') return 1;
  if (unit === 'ml') return 200;
  if (food.category === 'fats' && unit === 'g') return 15;
  return 100;
}

export function gramsFromAmount(
  food: FoodNutritionEntry,
  amount: number,
  unit: FoodAmountUnit,
): number {
  switch (unit) {
    case 'g':
      return amount;
    case 'ml':
      return amount;
    case 'buc':
      return amount * (food.pieceGrams ?? 100);
    case 'lingura':
      return amount * (food.tbspGrams ?? 15);
  }
}

export function macrosForFood(
  id: string,
  amount: number,
  unit: FoodAmountUnit,
): MealMacros | null {
  const food = getFoodNutrition(id);
  if (!food || amount <= 0) return null;

  const grams = gramsFromAmount(food, amount, unit);
  const factor = grams / 100;
  return {
    calories: Math.round(food.per100.calories * factor),
    protein:  Math.round(food.per100.protein  * factor * 10) / 10,
    carbs:    Math.round(food.per100.carbs    * factor * 10) / 10,
    fat:      Math.round(food.per100.fat      * factor * 10) / 10,
  };
}

export function sumFoodMacros(items: MealMacros[]): MealMacros {
  const total = items.reduce(
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

export function formatFoodLine(
  food: FoodNutritionEntry,
  amount: number,
  unit: FoodAmountUnit,
): string {
  const unitLabel = unit === 'lingura' && amount === 1
    ? 'lingură'
    : `${amount}${FOOD_AMOUNT_UNIT_LABELS[unit]}`;
  return `${unitLabel} ${food.label}`;
}
