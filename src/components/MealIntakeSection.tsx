import { useState } from 'react';
import type { MealFormFields, MealSlot } from '../lib/mealIntake';
import { macrosFromForm } from '../lib/mealIntake';
import { mealMacrosToFormFields } from '../lib/mealMacrosAi';

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
}

export default function MealIntakeSection({
  slot,
  label,
  icon,
  fields,
  onChange,
  defaultExpanded = true,
}: MealIntakeSectionProps) {
  const [description, setDescription] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateOk, setEstimateOk] = useState(false);

  const sub = macrosFromForm(fields);
  const computedCal = caloriesFromMacros(
    Number(fields.protein) || 0,
    Number(fields.carbs) || 0,
    Number(fields.fat) || 0,
  );

  function updateMacro(key: 'protein' | 'carbs' | 'fat', value: string) {
    const next = { ...fields, [key]: value };
    const p = Number(next.protein) || 0;
    const c = Number(next.carbs) || 0;
    const fat = Number(next.fat) || 0;
    if (p > 0 || c > 0 || fat > 0) {
      next.calories = String(caloriesFromMacros(p, c, fat));
    }
    onChange(next);
  }

  async function handleEstimate(e: React.SyntheticEvent) {
    e.preventDefault();
    const text = description.trim();
    if (text.length < 3) {
      setEstimateError('Scrie ce ai mâncat (min. 3 caractere).');
      return;
    }
    setEstimating(true);
    setEstimateError(null);
    setEstimateOk(false);
    try {
      const res = await fetch('/api/meal-estimate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ description: text, meal: label }),
      });
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      };
      if (!res.ok) throw new Error(data.error ?? 'Estimare eșuată');
      onChange(mealMacrosToFormFields({
        calories: data.calories ?? 0,
        protein:  data.protein  ?? 0,
        carbs:    data.carbs    ?? 0,
        fat:      data.fat      ?? 0,
      }));
      setEstimateOk(true);
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : 'Estimare eșuată');
    } finally {
      setEstimating(false);
    }
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
            ? `${sub.calories} kcal · ${sub.protein}g P`
            : '—'}
        </span>
      </summary>

      <div className="px-3 pb-3 pt-0 flex flex-col gap-2 border-t border-gray-700/50">
        <form onSubmit={handleEstimate} className="flex flex-col gap-1.5 pt-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Ce ai mâncat
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setEstimateError(null);
              setEstimateOk(false);
            }}
            rows={2}
            maxLength={500}
            placeholder="ex. 2 ouă, o felie pâine, iaurt grecesc…"
            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white
                       placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500"
            data-testid={`meal-${slot}-description`}
          />
          <button
            type="submit"
            disabled={estimating || description.trim().length < 3}
            className="self-start px-3 py-1.5 rounded-lg text-[11px] font-semibold
                       bg-violet-600/25 border border-violet-500/40 text-violet-200
                       hover:bg-violet-600/35 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid={`meal-${slot}-estimate`}
          >
            {estimating ? 'Estimez…' : '✨ Estimează macro'}
          </button>
          {estimateOk && (
            <p className="text-[10px] text-green-400">Macro completate — verifică și salvează ziua.</p>
          )}
          {estimateError && (
            <p className="text-[10px] text-red-400">{estimateError}</p>
          )}
        </form>

        <div className="grid grid-cols-2 gap-2">
          {([
            ['protein',  'Protein',  'g',    '💪', false],
            ['carbs',    'Carbs',    'g',    '🍚', false],
            ['fat',      'Fat',      'g',    '🥑', false],
            ['calories', 'Calories', 'kcal', '🔥', true],
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
                    onChange({ ...fields, calories: e.target.value });
                  }
                }}
                className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2.5
                           text-white placeholder-gray-600 text-sm
                           focus:outline-none focus:border-violet-500 transition-colors"
                data-testid={`meal-${slot}-${key}`}
              />
              {isCalories && computedCal > 0 && (
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
