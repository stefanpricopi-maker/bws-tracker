/**
 * Map meal-plan ingredients → food-picker rows.
 */

import {
  formatFoodLine,
  getFoodNutrition,
  FOOD_NUTRITION,
  type FoodAmountUnit,
} from './foodNutrition';

export interface MealPickerItem {
  id:     string;
  amount: number;
  unit:   FoodAmountUnit;
  line:   string;
}

export interface PlanIngredientSource {
  item:     string;
  food_id?: string;
  amount?:  number;
  unit?:    FoodAmountUnit;
  amount_g: number;
}

function findFoodIdByLabel(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  for (const food of FOOD_NUTRITION) {
    if (food.label.toLowerCase() === normalized) return food.id;
  }
  return null;
}

export function pickerItemsFromPlanIngredients(
  ingredients: PlanIngredientSource[],
): MealPickerItem[] {
  const items: MealPickerItem[] = [];

  for (const ing of ingredients) {
    const id = ing.food_id ?? findFoodIdByLabel(ing.item);
    if (!id) continue;

    const food = getFoodNutrition(id);
    if (!food) continue;

    const unit = ing.unit ?? 'g';
    const amount = ing.amount ?? ing.amount_g;

    items.push({
      id,
      amount,
      unit,
      line: formatFoodLine(food, amount, unit),
    });
  }

  return items;
}
