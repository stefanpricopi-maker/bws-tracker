import { describe, it, expect } from 'vitest';
import { pickerItemsFromPlanIngredients } from './mealPlanPicker';

describe('pickerItemsFromPlanIngredients', () => {
  it('builds picker rows from plan food ids', () => {
    const items = pickerItemsFromPlanIngredients([
      {
        item:     'Ovăz',
        food_id:  'oats',
        amount:   60,
        unit:     'g',
        amount_g: 60,
        protein:  0,
        carbs:    0,
        fat:      0,
        calories: 0,
      },
      {
        item:     'Lapte integral',
        food_id:  'milk_whole',
        amount:   200,
        unit:     'ml',
        amount_g: 200,
        protein:  0,
        carbs:    0,
        fat:      0,
        calories: 0,
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('oats');
    expect(items[0].line).toContain('Ovăz');
    expect(items[1].unit).toBe('ml');
  });

  it('falls back to label match when food_id missing', () => {
    const items = pickerItemsFromPlanIngredients([
      { item: 'Piept de pui', amount_g: 170, protein: 0, carbs: 0, fat: 0, calories: 0 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('chicken_breast');
  });
});
