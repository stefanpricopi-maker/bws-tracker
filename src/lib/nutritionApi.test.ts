import { describe, it, expect } from 'vitest';
import {
  extractPer100gMacros,
  normalizeIngredientForApi,
  parseIngredientQuantity,
  parseMealDescriptionToIngredients,
  pickBestUsdaFood,
  scaleMacros,
  sumMacros,
} from './nutritionApi';

describe('nutritionApi', () => {
  it('splits multiline and comma-separated ingredients', () => {
    expect(parseMealDescriptionToIngredients('200g ovăz\n5 curmale, 200 ml lapte')).toEqual([
      '200g ovăz',
      '5 curmale',
      '200 ml lapte',
    ]);
  });

  it('normalizes Romanian ingredient lines', () => {
    expect(normalizeIngredientForApi('fulgi de ovaz 200g')).toBe('oats 200g');
    expect(normalizeIngredientForApi('o banana')).toBe('1 banana');
    expect(normalizeIngredientForApi('o banaba')).toBe('1 banana');
    expect(normalizeIngredientForApi('o lingura peanut butter')).toBe('1 tbsp peanut butter');
  });

  it('prefers raw oats over oat milk for large portions', () => {
    const foods = [
      {
        description: 'Oat milk',
        foodNutrients: [
          { nutrientId: 1008, value: 45 },
          { nutrientId: 1003, value: 0.66 },
          { nutrientId: 1005, value: 5.37 },
          { nutrientId: 1004, value: 2.33 },
        ],
      },
      {
        description: 'Oats, raw',
        foodNutrients: [
          { nutrientId: 1008, value: 379 },
          { nutrientId: 1003, value: 13.15 },
          { nutrientId: 1005, value: 67.7 },
          { nutrientId: 1004, value: 6.52 },
        ],
      },
    ];
    expect(pickBestUsdaFood('oats', foods, 200)?.description).toBe('Oats, raw');
  });

  it('parses quantities from ingredient lines', () => {
    expect(parseIngredientQuantity('200g oats')).toEqual({ query: 'oats', grams: 200 });
    expect(parseIngredientQuantity('5 dates')).toEqual({ query: 'dates', grams: 35 });
    expect(parseIngredientQuantity('200 ml milk')).toEqual({ query: 'milk', grams: 200 });
    expect(parseIngredientQuantity('1 tbsp peanut butter')).toEqual({
      query: 'peanut butter',
      grams: 16,
    });
  });

  it('extracts and scales USDA nutrients', () => {
    const per100 = extractPer100gMacros({
      foodNutrients: [
        { nutrientId: 1008, value: 389 },
        { nutrientId: 1003, value: 16.9 },
        { nutrientId: 1005, value: 66.3 },
        { nutrientId: 1004, value: 6.9 },
      ],
    });
    expect(scaleMacros(per100, 200)).toEqual({
      calories: 778,
      protein:  33.8,
      carbs:    132.6,
      fat:      13.8,
    });
    expect(sumMacros([scaleMacros(per100, 200)])).toEqual({
      calories: 778,
      protein:  34,
      carbs:    133,
      fat:      14,
    });
  });
});
