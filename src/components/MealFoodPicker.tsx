import { useEffect, useMemo, useRef, useState } from 'react';
import {
  availableUnitsForFood,
  defaultAmountForFood,
  defaultUnitForFood,
  formatFoodLine,
  FOOD_AMOUNT_UNIT_LABELS,
  getFoodNutrition,
  macrosForFood,
  searchFoodNutrition,
  sumFoodMacros,
  type FoodAmountUnit,
  type FoodNutritionEntry,
} from '../lib/foodNutrition';
import { mealMacrosToFormFields } from '../lib/mealMacrosAi';
import type { MealFormFields } from '../lib/mealIntake';

interface AddedFood {
  id:       string;
  amount:   number;
  unit:     FoodAmountUnit;
  line:     string;
}

interface MealFoodPickerProps {
  slot:     string;
  onChange: (fields: MealFormFields) => void;
}

export default function MealFoodPicker({ slot, onChange }: MealFoodPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FoodNutritionEntry | null>(null);
  const [amount, setAmount] = useState('100');
  const [unit, setUnit] = useState<FoodAmountUnit>('g');
  const [items, setItems] = useState<AddedFood[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => (open ? searchFoodNutrition(query) : []),
    [open, query],
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function applyItems(next: AddedFood[]) {
    setItems(next);
    const macros = next
      .map((item) => macrosForFood(item.id, item.amount, item.unit))
      .filter((m): m is NonNullable<typeof m> => m != null);
    onChange(mealMacrosToFormFields(sumFoodMacros(macros)));
  }

  function selectFood(food: FoodNutritionEntry) {
    const nextUnit = defaultUnitForFood(food);
    setSelected(food);
    setQuery(food.label);
    setUnit(nextUnit);
    setAmount(String(defaultAmountForFood(food, nextUnit)));
    setOpen(false);
    setAddError(null);
  }

  function handleAdd() {
    if (!selected) {
      setAddError('Alege un aliment din listă.');
      return;
    }
    const parsed = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setAddError('Cantitate invalidă.');
      return;
    }

    applyItems([
      ...items,
      {
        id:     selected.id,
        amount: parsed,
        unit,
        line:   formatFoodLine(selected, parsed, unit),
      },
    ]);
    setQuery('');
    setSelected(null);
    setAmount('100');
    setUnit('g');
    setAddError(null);
  }

  function removeItem(index: number) {
    applyItems(items.filter((_, i) => i !== index));
  }

  const units = selected ? availableUnitsForFood(selected) : ['g' as const];

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Adaugă aliment
      </label>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
            setAddError(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Caută: ovăz, lapte, banane…"
          className="w-full rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white
                     placeholder-gray-600 focus:outline-none focus:border-violet-500"
          data-testid={`meal-${slot}-food-search`}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul
            className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-600
                       bg-gray-900 shadow-lg"
            data-testid={`meal-${slot}-food-suggestions`}
          >
            {suggestions.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => selectFood(food)}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-violet-600/20
                             border-b border-gray-800 last:border-b-0"
                >
                  <span className="font-medium">{food.label}</span>
                  <span className="ml-2 text-[11px] text-gray-500">
                    {food.per100.calories} kcal / 100g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 min-w-[88px]">
            <span className="text-[10px] text-gray-500">Cantitate</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-1.5 text-sm text-white
                         focus:outline-none focus:border-violet-500 w-24"
              data-testid={`meal-${slot}-food-amount`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500">Unitate</span>
            <select
              value={unit}
              onChange={(e) => {
                const next = e.target.value as FoodAmountUnit;
                setUnit(next);
                if (selected) setAmount(String(defaultAmountForFood(selected, next)));
              }}
              className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-1.5 text-sm text-white
                         focus:outline-none focus:border-violet-500"
              data-testid={`meal-${slot}-food-unit`}
            >
              {units.map((u) => (
                <option key={u} value={u}>{FOOD_AMOUNT_UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold
                       bg-violet-600/25 border border-violet-500/40 text-violet-200
                       hover:bg-violet-600/35"
            data-testid={`meal-${slot}-food-add`}
          >
            + Adaugă
          </button>
        </div>
      )}

      {addError && (
        <p className="text-[10px] text-red-400">{addError}</p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-1 pt-1" data-testid={`meal-${slot}-food-list`}>
          {items.map((item, index) => {
            const food = getFoodNutrition(item.id);
            const macros = macrosForFood(item.id, item.amount, item.unit);
            return (
              <li
                key={`${item.id}-${index}-${item.line}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/60 px-2.5 py-1.5"
              >
                <span className="text-[11px] text-gray-200 truncate">
                  {item.line}
                  {macros && (
                    <span className="text-gray-500"> · {macros.calories} kcal</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-gray-500 hover:text-red-400 text-xs shrink-0"
                  aria-label={`Elimină ${food?.label ?? item.id}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
