import { useMemo, useState } from 'react';
import {
  FOOD_CATALOG,
  FOOD_CATEGORY_LABELS,
  type FoodCategory,
} from '../lib/foodCatalog';
import {
  MIN_ALLOWED_FOODS,
  canGenerateMealPlan,
  addCustomFood,
  removeCustomFood,
  type MealPreferences,
} from '../lib/mealPreferences';

interface MealFoodPreferencesProps {
  preferences: MealPreferences;
  onChange: (prefs: MealPreferences) => void;
  onSave: () => void;
  saving?: boolean;
  saveStatus?: 'idle' | 'ok' | 'err';
}

const CATEGORY_ORDER: FoodCategory[] = [
  'protein',
  'dairy',
  'carbs',
  'vegetables',
  'fats',
  'snacks',
];

export default function MealFoodPreferences({
  preferences,
  onChange,
  onSave,
  saving = false,
  saveStatus = 'idle',
}: MealFoodPreferencesProps) {
  const { allowedIds, customFoods } = preferences;
  const [query, setQuery] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const allowedSet = useMemo(() => new Set(allowedIds), [allowedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FOOD_CATALOG;
    return FOOD_CATALOG.filter((f) => f.label.toLowerCase().includes(q));
  }, [query]);

  const filteredCustom = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customFoods;
    return customFoods.filter((f) => f.label.toLowerCase().includes(q));
  }, [query, customFoods]);

  const byCategory = useMemo(() => {
    const map = new Map<FoodCategory, typeof FOOD_CATALOG>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const item of filtered) {
      map.get(item.category)?.push(item);
    }
    return map;
  }, [filtered]);

  function toggle(id: string) {
    if (allowedSet.has(id)) {
      onChange({ ...preferences, allowedIds: allowedIds.filter((x) => x !== id) });
    } else {
      onChange({ ...preferences, allowedIds: [...allowedIds, id] });
    }
  }

  function selectAllVisible() {
    const visibleIds = [
      ...filtered.map((f) => f.id),
      ...filteredCustom.map((f) => f.id),
    ];
    onChange({
      ...preferences,
      allowedIds: [...new Set([...allowedIds, ...visibleIds])],
    });
  }

  function clearAllVisible() {
    const visible = new Set([
      ...filtered.map((f) => f.id),
      ...filteredCustom.map((f) => f.id),
    ]);
    onChange({
      ...preferences,
      allowedIds: allowedIds.filter((id) => !visible.has(id)),
    });
  }

  function handleAddCustom(e: React.SyntheticEvent) {
    e.preventDefault();
    setAddError(null);
    const { prefs, error } = addCustomFood(preferences, newLabel);
    if (error) {
      setAddError(error);
      return;
    }
    onChange(prefs);
    setNewLabel('');
  }

  function handleRemoveCustom(id: string) {
    onChange(removeCustomFood(preferences, id));
  }

  const canGenerate = canGenerateMealPlan(allowedIds);

  return (
    <div
      className="rounded-2xl flex flex-col gap-3 p-4"
      style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      data-testid="meal-food-preferences"
    >
      <div>
        <p className="text-sm font-bold text-white">Preferințe Plan AI</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
          Bifează ce vrei în plan. Adaugă alimente care nu sunt în listă.
        </p>
      </div>

      <form onSubmit={handleAddCustom} className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => {
            setNewLabel(e.target.value);
            setAddError(null);
          }}
          placeholder="Ex: Mici, sarmale, smoothie…"
          maxLength={48}
          className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white
                     placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          data-testid="food-pref-add-input"
        />
        <button
          type="submit"
          disabled={!newLabel.trim()}
          className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/30 border border-emerald-500/50
                     text-emerald-200 hover:bg-emerald-600/40 disabled:opacity-50"
          data-testid="food-pref-add-btn"
        >
          Adaugă element
        </button>
      </form>
      {addError && <p className="text-[11px] text-red-400">{addError}</p>}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Caută aliment…"
        className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white
                   placeholder-gray-600 focus:outline-none focus:border-emerald-500"
        data-testid="food-pref-search"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectAllVisible}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-800 border border-gray-700 text-gray-300"
        >
          Bifează vizibile
        </button>
        <button
          type="button"
          onClick={clearAllVisible}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-800 border border-gray-700 text-gray-300"
        >
          Debifează vizibile
        </button>
        <span className="text-[11px] text-gray-500 self-center ml-auto tabular-nums">
          {allowedIds.length} selectate
          {!canGenerate && (
            <span className="text-amber-400"> · min. {MIN_ALLOWED_FOODS}</span>
          )}
        </span>
      </div>

      <div className="max-h-56 overflow-y-auto flex flex-col gap-3 pr-1">
        {filteredCustom.length > 0 && (
          <div data-testid="meal-custom-foods">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-1.5">
              Ale tale
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {filteredCustom.map((food) => (
                <div
                  key={food.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border text-[11px] ${
                    allowedSet.has(food.id)
                      ? 'bg-violet-900/30 border-violet-700/50 text-violet-100'
                      : 'bg-gray-800/50 border-gray-700/50 text-gray-400'
                  }`}
                >
                  <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={allowedSet.has(food.id)}
                      onChange={() => toggle(food.id)}
                      className="rounded border-gray-600 text-violet-500 focus:ring-violet-500 shrink-0"
                      data-testid={`food-pref-${food.id}`}
                    />
                    <span className="leading-tight truncate">{food.label}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustom(food.id)}
                    className="shrink-0 w-6 h-6 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-900/30"
                    aria-label={`Șterge ${food.label}`}
                    data-testid={`food-pref-remove-${food.id}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                {FOOD_CATEGORY_LABELS[cat]}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((food) => (
                  <label
                    key={food.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer border text-[11px] transition-colors ${
                      allowedSet.has(food.id)
                        ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-100'
                        : 'bg-gray-800/50 border-gray-700/50 text-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={allowedSet.has(food.id)}
                      onChange={() => toggle(food.id)}
                      className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                      data-testid={`food-pref-${food.id}`}
                    />
                    <span className="leading-tight">{food.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-gray-700/50">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !canGenerate}
          className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-700 text-white
                     hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Se salvează…' : 'Salvează preferințe'}
        </button>
        {saveStatus === 'ok' && (
          <span className="text-[11px] text-green-400">Salvat ✓</span>
        )}
        {saveStatus === 'err' && (
          <span className="text-[11px] text-red-400">Eroare la salvare</span>
        )}
      </div>
    </div>
  );
}
