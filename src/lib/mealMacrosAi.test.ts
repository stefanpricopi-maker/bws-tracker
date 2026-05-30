import { describe, it, expect } from 'vitest';
import {
  normalizeMealMacros,
  validateMealDescription,
} from './mealMacrosAi';

describe('mealMacrosAi', () => {
  it('normalizes macro numbers', () => {
    expect(normalizeMealMacros({ calories: 450.7, protein: 32.2, carbs: 40, fat: 12.9 })).toEqual({
      calories: 451,
      protein: 32,
      carbs: 40,
      fat: 13,
    });
  });

  it('validates description length', () => {
    expect(validateMealDescription('ab')).toBeNull();
    expect(validateMealDescription('2 ouă și pâine')).toBe('2 ouă și pâine');
    expect(validateMealDescription('200g ovăz\n5 curmale')).toBe('200g ovăz\n5 curmale');
  });
});
