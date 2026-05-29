import { describe, it, expect } from 'vitest';
import {
  resolveMealPreferences,
  parseMealPreferencesJson,
  sanitizeMealPreferencesInput,
  canGenerateMealPlan,
  defaultMealPreferences,
  addCustomFood,
  removeCustomFood,
  allowedFoodLabels,
  createCustomFoodId,
} from './mealPreferences';
import { buildMacroSolverPrompt } from './macroSolverPrompt';

describe('mealPreferences', () => {
  it('defaults to full catalog when nothing stored', () => {
    const d = defaultMealPreferences();
    expect(resolveMealPreferences(null).allowedIds).toEqual(d.allowedIds);
  });

  it('parses legacy array JSON', () => {
    const p = parseMealPreferencesJson(JSON.stringify(['chicken_breast', 'rice_white', 'bogus']));
    expect(p?.allowedIds).toEqual(['chicken_breast', 'rice_white']);
    expect(p?.customFoods).toEqual([]);
  });

  it('parses object with custom foods', () => {
    const p = parseMealPreferencesJson(
      JSON.stringify({
        allowedIds: ['chicken_breast', 'custom_mici'],
        customFoods: [{ id: 'custom_mici', label: 'Mici la grătar' }],
      }),
    );
    expect(p?.customFoods[0].label).toBe('Mici la grătar');
    expect(allowedFoodLabels(resolveMealPreferences(p))).toContain('Mici la grătar');
  });

  it('requires minimum foods to generate', () => {
    expect(canGenerateMealPlan(['chicken_breast', 'rice_white', 'broccoli', 'eggs', 'oats'])).toBe(true);
    expect(canGenerateMealPlan(['chicken_breast'])).toBe(false);
  });

  it('adds custom food and auto-selects it', () => {
    const base = { allowedIds: ['chicken_breast'], customFoods: [] };
    const { prefs, error } = addCustomFood(base, 'Ciorbă de burtă');
    expect(error).toBeUndefined();
    expect(prefs.customFoods).toHaveLength(1);
    expect(prefs.allowedIds).toContain(prefs.customFoods[0].id);
  });

  it('rejects duplicate custom labels', () => {
    const base = addCustomFood(
      { allowedIds: [], customFoods: [] },
      'Plăcintă',
    ).prefs;
    const { error } = addCustomFood(base, 'plăcintă');
    expect(error).toBeTruthy();
  });

  it('removes custom food from allowed and list', () => {
    const { prefs } = addCustomFood(defaultMealPreferences(), 'Zacusca');
    const id = prefs.customFoods[0].id;
    const next = removeCustomFood(prefs, id);
    expect(next.customFoods).toHaveLength(0);
    expect(next.allowedIds).not.toContain(id);
  });

  it('creates unique custom ids', () => {
    const ids = new Set<string>();
    ids.add(createCustomFoodId('Ouă', ids));
    expect(createCustomFoodId('Ouă', ids)).not.toBe('custom_oua');
  });

  it('sanitizes meal preferences input', () => {
    const p = sanitizeMealPreferencesInput({
      allowedIds: ['chicken_breast', 'custom_x', 'bad'],
      customFoods: [{ id: 'custom_x', label: 'Sarmale' }],
    });
    expect(p?.allowedIds).toEqual(['chicken_breast', 'custom_x']);
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
