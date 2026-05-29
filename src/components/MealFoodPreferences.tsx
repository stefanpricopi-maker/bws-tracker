import { useMemo, useState } from 'react';
import {
  FOOD_CATALOG,
  FOOD_CATEGORY_LABELS,
  type FoodCategory,
} from '../lib/foodCatalog';
import { MIN_ALLOWED_FOODS, canGenerateMealPlan } from '../lib/mealPreferences';

interface MealFoodPreferencesProps {
  allowedIds: string[];
  onChange: (ids: string[]) => void;
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
  allowedIds,
  onChange,
  onSave,
  saving = false,
  saveStatus = 'idle',
}: MealFoodPreferencesProps) {
  const [query, setQuery] = useState('');
  const allowedSet = useMemo(() => new Set(allowedIds), [allowedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FOOD_CATALOG;
    return FOOD_CATALOG.filter((f) => f.label.toLowerCase().includes(q));
  }, [query]);

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
      onChange(allowedIds.filter((x) => x !== id));
    } else {
      onChange([...allowedIds, id]);
    }
  }

  function selectAllVisible() {
    const visibleIds = filtered.map((f) => f.id);
    onChange([...new Set([...allowedIds, ...visibleIds])]);
  }

  function clearAllVisible() {
    const visible = new Set(filtered.map((f) => f.id));
    onChange(allowedIds.filter((id) => !visible.has(id)));
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
          Bifează ce vrei în plan. Debifat = nu îți recomandăm acel aliment.
        </p>
      </div>

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
