/** Curated foods for AI meal plan — user picks allowed items. */

export type FoodCategory =
  | 'protein'
  | 'carbs'
  | 'vegetables'
  | 'fats'
  | 'snacks'
  | 'dairy';

export interface FoodItem {
  id:       string;
  label:    string;
  category: FoodCategory;
}

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  protein:    'Proteine & carne',
  carbs:      'Carbohidrați',
  vegetables: 'Legume',
  fats:       'Grăsimi sănătoase',
  snacks:     'Gustări & fructe',
  dairy:      'Lactate',
};

export const FOOD_CATALOG: FoodItem[] = [
  // protein
  { id: 'chicken_breast', label: 'Piept de pui', category: 'protein' },
  { id: 'chicken_thigh', label: 'Pulpe de pui (fără piele)', category: 'protein' },
  { id: 'turkey', label: 'Curcan', category: 'protein' },
  { id: 'beef_lean', label: 'Vită slabă', category: 'protein' },
  { id: 'pork_loin', label: 'Mușchi de porc', category: 'protein' },
  { id: 'salmon', label: 'Somon', category: 'protein' },
  { id: 'tuna', label: 'Ton (conservă în apă)', category: 'protein' },
  { id: 'cod', label: 'Cod / pește alb', category: 'protein' },
  { id: 'shrimp', label: 'Creveți', category: 'protein' },
  { id: 'eggs', label: 'Ouă întregi', category: 'protein' },
  { id: 'egg_whites', label: 'Albuș', category: 'protein' },
  { id: 'tofu', label: 'Tofu', category: 'protein' },
  { id: 'whey', label: 'Pudră proteică (whey)', category: 'protein' },
  // dairy
  { id: 'greek_yogurt', label: 'Iaurt grecesc', category: 'dairy' },
  { id: 'cottage_cheese', label: 'Brânză cottage', category: 'dairy' },
  { id: 'telemea', label: 'Telemea', category: 'dairy' },
  { id: 'mozzarella', label: 'Mozzarella', category: 'dairy' },
  { id: 'milk_skim', label: 'Lapte degresat', category: 'dairy' },
  { id: 'milk_whole', label: 'Lapte integral', category: 'dairy' },
  // carbs
  { id: 'rice_white', label: 'Orez alb', category: 'carbs' },
  { id: 'rice_brown', label: 'Orez brun', category: 'carbs' },
  { id: 'pasta', label: 'Paste', category: 'carbs' },
  { id: 'potato', label: 'Cartofi', category: 'carbs' },
  { id: 'sweet_potato', label: 'Cartofi dulci', category: 'carbs' },
  { id: 'bread_whole', label: 'Pâine integrală', category: 'carbs' },
  { id: 'oats', label: 'Ovăz', category: 'carbs' },
  { id: 'quinoa', label: 'Quinoa', category: 'carbs' },
  { id: 'tortilla', label: 'Lipii / tortilla', category: 'carbs' },
  { id: 'couscous', label: 'Couscous', category: 'carbs' },
  // vegetables
  { id: 'broccoli', label: 'Broccoli', category: 'vegetables' },
  { id: 'spinach', label: 'Spanac', category: 'vegetables' },
  { id: 'salad_mix', label: 'Salată verde', category: 'vegetables' },
  { id: 'tomato', label: 'Roșii', category: 'vegetables' },
  { id: 'cucumber', label: 'Castraveți', category: 'vegetables' },
  { id: 'pepper', label: 'Ardei', category: 'vegetables' },
  { id: 'mushrooms', label: 'Ciuperci', category: 'vegetables' },
  { id: 'zucchini', label: 'Dovlecel', category: 'vegetables' },
  { id: 'green_beans', label: 'Fasole verde', category: 'vegetables' },
  { id: 'carrot', label: 'Morcov', category: 'vegetables' },
  // fats
  { id: 'olive_oil', label: 'Ulei de măsline', category: 'fats' },
  { id: 'avocado', label: 'Avocado', category: 'fats' },
  { id: 'almonds', label: 'Migdale', category: 'fats' },
  { id: 'walnuts', label: 'Nuci', category: 'fats' },
  { id: 'peanut_butter', label: 'Unt de arahide', category: 'fats' },
  { id: 'peanuts', label: 'Arahide', category: 'fats' },
  // snacks
  { id: 'protein_bar', label: 'Bară proteică', category: 'snacks' },
  { id: 'banana', label: 'Banane', category: 'snacks' },
  { id: 'dates', label: 'Curmale', category: 'snacks' },
  { id: 'apple', label: 'Mere', category: 'snacks' },
  { id: 'berries', label: 'Fructe de pădure', category: 'snacks' },
  { id: 'hummus', label: 'Humus', category: 'snacks' },
  { id: 'rice_cakes', label: 'Vafe de orez', category: 'snacks' },
  { id: 'dark_chocolate', label: 'Ciocolată neagră (70%+)', category: 'snacks' },
];

export const FOOD_CATALOG_IDS = new Set(FOOD_CATALOG.map((f) => f.id));

export const ALL_FOOD_IDS = FOOD_CATALOG.map((f) => f.id);

export function foodLabelById(id: string): string | undefined {
  return FOOD_CATALOG.find((f) => f.id === id)?.label;
}
