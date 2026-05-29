const SCHEMA = `{
  "meals": [
    {
      "meal_name": "string",
      "ingredients": [
        { "item": "string", "amount_g": number, "protein": number, "carbs": number, "fat": number, "calories": number }
      ],
      "total_calories": number
    }
  ],
  "daily_totals": { "calories": number, "protein": number, "carbs": number, "fat": number }
}`;

export function buildMacroSolverPrompt(
  targets: { calories: number; protein: number; fat: number; carbs: number },
  allowedFoodLabels: string[],
): string {
  const allowedList = allowedFoodLabels.join(', ');

  return `You are a strict nutrition calculator. The user needs exactly:
${targets.calories} kcal, ${targets.protein}g Protein, ${targets.fat}g Fat, ${targets.carbs}g Carbs.

Generate a 4-meal plan for today (Breakfast, Lunch, Snacks between lunch and dinner, Dinner) that hits these macros exactly (+/- 5% margin of error).
Snacks may include protein bars, nuts, fruit, yogurt — allocate a realistic share of daily calories there when it helps hit targets.

CRITICAL — The user selected ONLY these foods they want in the plan. Use ONLY items from this list (match names closely in Romanian or English). Do NOT use any ingredient not on this list:
${allowedList}

Weigh every ingredient to the nearest 5g. Be precise — this is a mathematical nutrition plan, not a recipe suggestion.

You MUST return ONLY a valid JSON object matching this exact schema, with no markdown, no backticks, no explanation text before or after:
${SCHEMA}

All numbers must be rounded to 1 decimal place. Verify that daily_totals matches the sum of all meals before responding.`;
}
