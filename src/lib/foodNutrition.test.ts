import { describe, it, expect } from 'vitest';
import {
  macrosForFood,
  searchFoodNutrition,
  sumFoodMacros,
} from './foodNutrition';

describe('foodNutrition', () => {
  it('finds foods by Romanian aliases', () => {
    expect(searchFoodNutrition('ovaz')[0]?.id).toBe('oats');
    expect(searchFoodNutrition('lapte')[0]?.id).toBe('milk_whole');
    expect(searchFoodNutrition('curmale')[0]?.id).toBe('dates');
    expect(searchFoodNutrition('unt arahide')[0]?.id).toBe('peanut_butter');
  });

  it('computes breakfast macros from predefined foods', () => {
    const parts = [
      macrosForFood('oats', 200, 'g'),
      macrosForFood('milk_whole', 200, 'ml'),
      macrosForFood('peanut_butter', 1, 'lingura'),
      macrosForFood('banana', 1, 'buc'),
      macrosForFood('dates', 5, 'buc'),
    ].filter((m): m is NonNullable<typeof m> => m != null);

    const total = sumFoodMacros(parts);
    expect(total.calories).toBeGreaterThan(1000);
    expect(total.calories).toBeLessThan(1300);
    expect(total.protein).toBeGreaterThan(30);
  });
});
