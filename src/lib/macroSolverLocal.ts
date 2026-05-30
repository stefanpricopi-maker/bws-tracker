/**
 * Daily meal plan from curated recipes + catalog nutrition data.
 */

import { MEAL_LABELS, MEAL_SLOTS, type MealMacros, type MealSlot } from './mealIntake';
import type { FoodAmountUnit } from './foodNutrition';
import {
  missingFoodLabelsForSlot,
  resolveRecipe,
  selectAlternateRecipeForSlot,
  selectBestMealPlanRecipes,
  type MealRecipeDef,
} from './mealRecipes';

export interface MealPlanIngredient {
  item:      string;
  food_id:   string;
  amount:    number;
  unit:      FoodAmountUnit;
  amount_g:  number;
  protein:   number;
  carbs:     number;
  fat:       number;
  calories:  number;
}

export interface MealPlanMeal {
  meal_name:      string;
  recipe_id:      string;
  recipe_name:    string;
  ingredients:    MealPlanIngredient[];
  total_calories: number;
}

export interface MealPlan {
  meals:        MealPlanMeal[];
  daily_totals: MealMacros;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildMealFromRecipe(slot: MealSlot, recipe: MealRecipeDef): MealPlanMeal {
  const { ingredients, totals } = resolveRecipe(recipe);
  return {
    meal_name:      MEAL_LABELS[slot],
    recipe_id:      recipe.id,
    recipe_name:    recipe.name,
    ingredients,
    total_calories: totals.calories,
  };
}

export function regenerateMealSlot(
  slot: MealSlot,
  targets: MealMacros,
  allowedIds: string[],
  excludeRecipeIds: string[],
): MealPlanMeal {
  const recipe = selectAlternateRecipeForSlot(
    slot,
    targets,
    allowedIds,
    new Set(excludeRecipeIds),
  );
  if (!recipe) {
    const hints = missingFoodLabelsForSlot(slot, allowedIds);
    const hint = hints.length > 0 ? ` Adaugă: ${hints.join(', ')}.` : '';
    throw new Error(`Nicio altă rețetă pentru ${MEAL_LABELS[slot]}.${hint}`);
  }
  return buildMealFromRecipe(slot, recipe);
}

export function generateMealPlanFromCatalog(
  targets: MealMacros,
  allowedIds: string[],
): MealPlan {
  if (allowedIds.length === 0) {
    throw new Error('Selectează alimente în preferințe înainte de a genera planul.');
  }

  const recipes = selectBestMealPlanRecipes(targets, allowedIds);
  if (!recipes) {
    for (const slot of MEAL_SLOTS) {
      const hints = missingFoodLabelsForSlot(slot, allowedIds);
      if (hints.length > 0) {
        throw new Error(`Nicio rețetă disponibilă pentru ${MEAL_LABELS[slot]}. Adaugă: ${hints.join(', ')}.`);
      }
    }
    throw new Error('Nicio combinație de rețete disponibilă cu alimentele selectate.');
  }

  const meals = recipes.map((recipe) => buildMealFromRecipe(recipe.slot, recipe));

  const daily_totals = meals.reduce(
    (acc, meal) => {
      for (const ing of meal.ingredients) {
        acc.calories += ing.calories;
        acc.protein  += ing.protein;
        acc.carbs    += ing.carbs;
        acc.fat      += ing.fat;
      }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    meals,
    daily_totals: {
      calories: Math.round(daily_totals.calories),
      protein:  round1(daily_totals.protein),
      carbs:    round1(daily_totals.carbs),
      fat:      round1(daily_totals.fat),
    },
  };
}
