import { describe, it, expect } from 'vitest';
import {
  resolveAllowedFoodIds,
  parseStoredAllowedFoodIds,
  sanitizeAllowedFoodIds,
  canGenerateMealPlan,
  defaultAllowedFoodIds,
} from './mealPreferences';
import { buildMacroSolverPrompt } from './macroSolverPrompt';

describe('mealPreferences', () => {
  it('defaults to full catalog when nothing stored', () => {
    expect(resolveAllowedFoodIds(null)).toEqual(defaultAllowedFoodIds());
  });

  it('parses stored JSON ids', () => {
    const ids = parseStoredAllowedFoodIds(JSON.stringify(['chicken_breast', 'rice_white', 'bogus']));
    expect(ids).toEqual(['chicken_breast', 'rice_white']);
  });

  it('requires minimum foods to generate', () => {
    expect(canGenerateMealPlan(['chicken_breast', 'rice_white', 'broccoli', 'eggs', 'oats'])).toBe(true);
    expect(canGenerateMealPlan(['chicken_breast'])).toBe(false);
  });

  it('sanitizes unknown ids', () => {
    expect(sanitizeAllowedFoodIds(['chicken_breast', 'xyz'])).toEqual(['chicken_breast']);
  });
});

describe('buildMacroSolverPrompt', () => {
  it('includes only allowed food labels', () => {
    const prompt = buildMacroSolverPrompt(
      { calories: 1800, protein: 150, fat: 60, carbs: 120 },
      ['Piept de pui', 'Orez alb'],
    );
    expect(prompt).toContain('Piept de pui');
    expect(prompt).toContain('Do NOT use any ingredient not on this list');
  });
});
