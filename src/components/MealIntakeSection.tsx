import { useState } from 'react';
import type { MealFormFields, MealSlot } from '../lib/mealIntake';
import { macrosFromForm } from '../lib/mealIntake';
import MealFoodPicker from './MealFoodPicker';

function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

interface MealIntakeSectionProps {
  slot: MealSlot;
  label: string;
  icon: string;
  fields: MealFormFields;
  onChange: (fields: MealFormFields) => void;
  defaultExpanded?: boolean;
  pickerItems?: import('../lib/mealPlanPicker').MealPickerItem[];
  pickerKey?: number;
  slotCalorieTarget?: number;
}

export default function MealIntakeSection({
  slot,
  label,
  icon,
  fields,
  onChange,
  defaultExpanded = true,
  pickerItems = [],
  pickerKey = 0,
  slotCalorieTarget,
}: MealIntakeSectionProps) {
  const [manualEdit, setManualEdit] = useState(false);

  const sub = macrosFromForm(fields);
  const computedCal = caloriesFromMacros(
    Number(fields.protein) || 0,
    Number(fields.carbs) || 0,
    Number(fields.fat) || 0,
  );

  function updateMacro(key: 'protein' | 'carbs' | 'fat', value: string) {
    setManualEdit(true);
    const next = { ...fields, [key]: value };
    const p = Number(next.protein) || 0;
    const c = Number(next.carbs) || 0;
    const fat = Number(next.fat) || 0;
    if (p > 0 || c > 0 || fat > 0) {
      next.calories = String(caloriesFromMacros(p, c, fat));
    }
    onChange(next);
  }

  function handlePickerChange(next: MealFormFields) {
    setManualEdit(false);
    onChange(next);
  }

  return (
    <details
      open={defaultExpanded}
      className="rounded-xl border border-gray-700/80 bg-gray-800/40 overflow-hidden group"
      data-testid={`meal-section-${slot}`}
    >
      <summary className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <span aria-hidden>{icon}</span>
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-gray-400">
          {sub.calories > 0 || sub.protein > 0
            ? `${sub.calories} kcal · ${sub.protein}g P${slotCalorieTarget ? ` / ~${slotCalorieTarget}` : ''}`
            : slotCalorieTarget
              ? `~${slotCalorieTarget} kcal țintă`
              : '—'}
        </span>
      </summary>

      <div className="px-3 pb-3 pt-0 flex flex-col gap-2 border-t border-gray-700/50">
        <div className="pt-2">
          <MealFoodPicker
            key={`${slot}-${pickerKey}`}
            slot={slot}
            initialItems={pickerItems}
            onChange={handlePickerChange}
          />
          <p className="text-[10px] text-gray-500 mt-2">
            Alege alimente din catalog — valorile sunt fixe, fără estimare AI.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([
            ['protein',  'Proteine', 'g',    '💪', false],
            ['carbs',    'Carbs',    'g',    '🍚', false],
            ['fat',      'Grăsimi',  'g',    '🥑', false],
            ['calories', 'Calorii',  'kcal', '🔥', true],
          ] as const).map(([key, fieldLabel, unit, fieldIcon, isCalories]) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 px-0.5">
                <span>{fieldIcon}</span>
                <span>{fieldLabel}</span>
                <span className="text-gray-600 font-normal">({unit})</span>
              </label>
              <input
                type="number"
                min="0"
                step={key === 'calories' ? '1' : '0.1'}
                placeholder={isCalories && computedCal > 0 ? String(computedCal) : '0'}
                value={fields[key]}
                onChange={(e) => {
                  if (key === 'protein' || key === 'carbs' || key === 'fat') {
                    updateMacro(key, e.target.value);
                  } else {
                    setManualEdit(true);
                    onChange({ ...fields, calories: e.target.value });
                  }
                }}
                className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2.5
                           text-white placeholder-gray-600 text-sm
                           focus:outline-none focus:border-violet-500 transition-colors"
                data-testid={`meal-${slot}-${key}`}
              />
              {isCalories && computedCal > 0 && !manualEdit && (
                <p className="text-[10px] text-gray-500 px-0.5">
                  Auto: {computedCal} kcal
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
