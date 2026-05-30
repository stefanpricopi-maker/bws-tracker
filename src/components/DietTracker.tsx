import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { resolveDietTargets } from '../lib/macroTargets';
import { calcEatBack } from '../lib/fitness';
import { readCachedActivitySync, cacheActivitySync } from '../lib/activitySync';
import MealIntakeSection from './MealIntakeSection';
import {
  canGenerateMealPlan,
  defaultMealPreferences,
  MIN_ALLOWED_FOODS,
  type MealPreferences,
} from '../lib/mealPreferences';
import {
  MEAL_SLOTS,
  MEAL_LABELS,
  EMPTY_DAY_MEALS,
  formatMacroGrams,
  storedMealsFromForm,
  sumDayMeals,
  parseStoredDayMeals,
  dayMealsFormFromStored,
  dayMealsFormFromDailyTotals,
  mealSlotFromPlanName,
  type DayMealsForm,
  type MealSlot,
} from '../lib/mealIntake';
import { pickerItemsFromPlanIngredients, type MealPickerItem } from '../lib/mealPlanPicker';
import { MEAL_CAL_SHARE } from '../lib/mealRecipes';

// ── Macro-Solver types ──────────────────────────────────────────────────────
interface MealIngredient {
  item:      string;
  food_id?:  string;
  amount?:   number;
  unit?:     string;
  amount_g:  number;
  protein:   number;
  carbs:     number;
  fat:       number;
  calories:  number;
}
interface Meal {
  meal_name:      string;
  recipe_id?:     string;
  recipe_name?:   string;
  ingredients:    MealIngredient[];
  total_calories: number;
}
interface MealPlan {
  meals:        Meal[];
  daily_totals: { calories: number; protein: number; carbs: number; fat: number };
}

const DEFAULT_TARGETS = {
  calories: 1850,
  protein:  180,
  fat:       75,
  carbs:    113,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

function pct(consumed: number, target: number) {
  return clamp(Math.round((consumed / target) * 100));
}

const today = () => new Date().toISOString().slice(0, 10);

const MEAL_ICONS: Record<MealSlot, string> = {
  breakfast: '🌅',
  lunch:     '☀️',
  snacks:    '🍫',
  dinner:    '🌙',
};

function applyLoggedTotals(setLogged: (v: Intake) => void, totals: ReturnType<typeof sumDayMeals>) {
  setLogged({
    calories: totals.calories,
    protein:  totals.protein,
    carbs:    totals.carbs,
    fat:      totals.fat,
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string; // Tailwind bg class
}

function MacroBar({ label, consumed, target, unit, color }: MacroBarProps) {
  const remaining = Math.max(0, Math.round((target - consumed) * 10) / 10);
  const overBy = Math.max(0, Math.round((consumed - target) * 10) / 10);
  const progress  = pct(consumed, target);
  const over      = consumed > target;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {label}
        </span>
        <span className="text-xs text-gray-500">
          <span className={over ? 'text-red-400 font-bold' : 'text-white font-semibold'}>
            {formatMacroGrams(consumed)}
          </span>
          <span className="text-gray-600"> / {formatMacroGrams(target)}{unit}</span>
          {!over && remaining > 0 && (
            <span className="text-gray-600"> · {formatMacroGrams(remaining)}{unit} rămas</span>
          )}
          {over && (
            <span className="text-red-400 font-semibold"> +{formatMacroGrams(overBy)}{unit} peste</span>
          )}
        </span>
      </div>
      {/* Track */}
      <div className="h-2.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : color}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Intake {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

const EMPTY: Intake = { calories: 0, protein: 0, carbs: 0, fat: 0 };

const EMPTY_PICKER_ITEMS = Object.fromEntries(
  MEAL_SLOTS.map((s) => [s, [] as MealPickerItem[]]),
) as Record<MealSlot, MealPickerItem[]>;

function planDailyTotals(meals: Meal[]): MealPlan['daily_totals'] {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.total_calories,
      protein:  acc.protein  + meal.ingredients.reduce((s, i) => s + i.protein, 0),
      carbs:    acc.carbs    + meal.ingredients.reduce((s, i) => s + i.carbs, 0),
      fat:      acc.fat      + meal.ingredients.reduce((s, i) => s + i.fat, 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

interface DietTrackerProps {
  onOpenProfile?: () => void;
}

export default function DietTracker({ onOpenProfile }: DietTrackerProps) {
  const [logged, setLogged]   = useState<Intake>(EMPTY);
  const [dayMeals, setDayMeals] = useState<DayMealsForm>({ ...EMPTY_DAY_MEALS });
  const [scanMeal, setScanMeal] = useState<MealSlot>('breakfast');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');
  const [isHydrated, setIsHydrated] = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [preview, setPreview]     = useState<string | null>(null);
  const [targets, setTargets]         = useState(DEFAULT_TARGETS);
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_TARGETS.calories);
  const [eatBackKcal, setEatBackKcal] = useState(0);
  const [targetsHint, setTargetsHint] = useState('');
  // Macro-Solver state
  const [solving, setSolving]       = useState(false);
  const [mealPlan, setMealPlan]     = useState<MealPlan | null>(null);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [regeneratingSlot, setRegeneratingSlot] = useState<MealSlot | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [logging, setLogging]       = useState(false);
  const [logStatus, setLogStatus]   = useState<'idle' | 'ok' | 'err'>('idle');
  const [mealPreferences, setMealPreferences] = useState<MealPreferences>(defaultMealPreferences);
  const [planPickerItems, setPlanPickerItems] = useState<Record<MealSlot, MealPickerItem[]>>(EMPTY_PICKER_ITEMS);
  const [planPickerKey, setPlanPickerKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSavedJsonRef = useRef(JSON.stringify(EMPTY_DAY_MEALS));
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setMealFields(slot: MealSlot, fields: DayMealsForm[MealSlot]) {
    setDayMeals((m) => ({ ...m, [slot]: fields }));
  }

  const saveDayMeals = useCallback(async (mealsForm: DayMealsForm) => {
    const stored = storedMealsFromForm(mealsForm);
    const totals = sumDayMeals(stored);
    const res = await fetch('/api/logs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        date:        today(),
        meals:       stored,
        calories_in: totals.calories || null,
        protein_g:   totals.protein  || null,
        carbs_g:     totals.carbs    || null,
        fat_g:       totals.fat      || null,
      }),
    });
    if (!res.ok) throw new Error('API error');
    applyLoggedTotals(setLogged, totals);
    return totals;
  }, []);

  function markMealsSaved(form: DayMealsForm) {
    lastSavedJsonRef.current = JSON.stringify(form);
  }

  function applyActivityBonus(activeCalories: number, baseCalories: number) {
    const { eatBack, adjustedTarget, isHigh } = calcEatBack(activeCalories, baseCalories);
    setEatBackKcal(isHigh ? eatBack : 0);
    setCalorieTarget(isHigh ? adjustedTarget : baseCalories);
  }

  async function handleRegenerateMeal(slot: MealSlot) {
    if (!mealPlan) return;
    const exclude = mealPlan.meals
      .map((m) => m.recipe_id)
      .filter((id): id is string => !!id);
    setRegeneratingSlot(slot);
    setRegenError(null);
    try {
      const params = new URLSearchParams({ slot, exclude: exclude.join(',') });
      const res  = await fetch(`/api/macro-solver?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Nu am putut schimba rețeta.');
      }
      const newMeal = data.meal as Meal;
      const nextMeals = mealPlan.meals.map((m) =>
        mealSlotFromPlanName(m.meal_name) === slot ? newMeal : m,
      );
      setMealPlan({ meals: nextMeals, daily_totals: planDailyTotals(nextMeals) });
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegeneratingSlot(null);
    }
  }

  async function handleSolveMacros() {
    if (!canGenerateMealPlan(mealPreferences.allowedIds)) {
      setSolveError(`Selectează cel puțin ${MIN_ALLOWED_FOODS} alimente în Profile → Settings.`);
      return;
    }
    setSolving(true);
    setSolveError(null);
    setMealPlan(null);
    setLogStatus('idle');
    try {
      const res  = await fetch('/api/macro-solver');
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : data.detail ?? 'Nu am putut genera planul.',
        );
      }
      const plan = data.plan as MealPlan;
      // Guard: validate shape
      if (!plan?.meals || !Array.isArray(plan.meals)) throw new Error('Invalid meal plan structure');
      setMealPlan(plan);
    } catch (err) {
      setSolveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSolving(false);
    }
  }

  async function handleLogMealPlan() {
    if (!mealPlan) return;
    setLogging(true);
    setLogStatus('idle');
    try {
      const nextForm: DayMealsForm = { ...EMPTY_DAY_MEALS };
      const nextPickerItems = { ...planPickerItems };
      for (const meal of mealPlan.meals) {
        const slot = mealSlotFromPlanName(meal.meal_name);
        nextPickerItems[slot] = pickerItemsFromPlanIngredients(meal.ingredients);
        const p = meal.ingredients.reduce((s, i) => s + i.protein, 0);
        const c = meal.ingredients.reduce((s, i) => s + i.carbs, 0);
        const f = meal.ingredients.reduce((s, i) => s + i.fat, 0);
        nextForm[slot] = {
          calories: String(Math.round(meal.total_calories)),
          protein:  String(Math.round(p)),
          carbs:    String(Math.round(c)),
          fat:      String(Math.round(f)),
        };
      }
      await saveDayMeals(nextForm);
      setPlanPickerItems(nextPickerItems);
      setPlanPickerKey((k) => k + 1);
      setDayMeals(nextForm);
      markMealsSaved(nextForm);
      setAutoSaveStatus('saved');
      setLogStatus('ok');
    } catch {
      setLogStatus('err');
    } finally {
      setLogging(false);
    }
  }

  // Load targets + today's log on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then((r) => r.json()),
      fetch('/api/logs?days=30').then((r) => r.json()),
    ])
      .then(([profile, rows]: [
        { goals?: {
          targetCaloriesKcal?: number | null;
          targetProteinG?: number | null;
          targetCarbsG?: number | null;
          targetFatG?: number | null;
          mealPreferences?: MealPreferences;
        } | null },
        Array<{
          date: string;
          weight_kg?: number | null;
          calories_in?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          meals?: ReturnType<typeof parseStoredDayMeals>;
        }>,
      ]) => {
        const weightLogs = rows.filter((r) => r.weight_kg != null);
        const latestWeight = weightLogs.length > 0 ? weightLogs[0].weight_kg! : null;
        const t = resolveDietTargets(profile.goals ?? null, latestWeight);
        setTargets({ calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat });
        setCalorieTarget(t.calories);
        setEatBackKcal(0);
        if (profile.goals?.mealPreferences) {
          setMealPreferences(profile.goals.mealPreferences);
        }
        if (latestWeight) {
          setTargetsHint(`Țintă proteine: ${t.protein}g (${latestWeight} kg × 1,8 g/kg). Ajustează în Profil.`);
        } else {
          setTargetsHint('Loghează greutatea în Stats pentru țintă personalizată (1,8 g/kg).');
        }

        const todayRow = rows.find((r) => r.date === today());
        let loadedForm: DayMealsForm = { ...EMPTY_DAY_MEALS };
        if (todayRow) {
          const totals = {
            calories: todayRow.calories_in ?? 0,
            protein:  todayRow.protein_g   ?? 0,
            carbs:    todayRow.carbs_g     ?? 0,
            fat:      todayRow.fat_g       ?? 0,
          };
          applyLoggedTotals(setLogged, totals);
          loadedForm = todayRow.meals
            ? dayMealsFormFromStored(todayRow.meals)
            : dayMealsFormFromDailyTotals(totals);
        }
        setDayMeals(loadedForm);
        markMealsSaved(loadedForm);
        setIsHydrated(true);
      })
      .catch(() => {
        setIsHydrated(true);
      });
  }, []);

  // Activity eat-back: cache from Home or silent Google Fit fetch
  useEffect(() => {
    const date = today();
    const cached = readCachedActivitySync(date);
    if (cached) {
      applyActivityBonus(cached.activeCalories, targets.calories);
      return;
    }
    fetch(`/api/sync/google-fit?date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { activeCalories?: number; steps?: number } | null) => {
        if (data?.activeCalories == null) return;
        cacheActivitySync({
          date,
          activeCalories: data.activeCalories,
          steps:          data.steps ?? 0,
        });
        applyActivityBonus(data.activeCalories, targets.calories);
      })
      .catch(() => {});
  }, [targets.calories]);

  const slotCalorieTargets = useMemo(
    () => Object.fromEntries(
      MEAL_SLOTS.map((s) => [s, Math.round(calorieTarget * MEAL_CAL_SHARE[s])]),
    ) as Record<MealSlot, number>,
    [calorieTarget],
  );

  // Auto-save after meal edits (debounced)
  useEffect(() => {
    if (!isHydrated) return;

    const snapshot = JSON.stringify(dayMeals);
    if (snapshot === lastSavedJsonRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      saveDayMeals(dayMeals)
        .then(() => {
          lastSavedJsonRef.current = snapshot;
          setAutoSaveStatus('saved');
          savedFadeTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000);
        })
        .catch(() => setAutoSaveStatus('err'));
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [dayMeals, isHydrated, saveDayMeals]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setScanStatus('idle');
    setScanning(true);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URL prefix → keep only the base64 payload
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type || 'image/jpeg' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const macros = await res.json() as { calories: number; protein: number; carbs: number; fat: number };

      setDayMeals((m) => ({
        ...m,
        [scanMeal]: {
          calories: macros.calories > 0 ? String(macros.calories) : '',
          protein:  macros.protein  > 0 ? String(macros.protein)  : '',
          carbs:    macros.carbs    > 0 ? String(macros.carbs)    : '',
          fat:      macros.fat      > 0 ? String(macros.fat)      : '',
        },
      }));
      setScanStatus('ok');
    } catch {
      setScanStatus('err');
    } finally {
      setScanning(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const calPct = pct(logged.calories, calorieTarget);
  const hasLogged = logged.calories > 0 || logged.protein > 0 || logged.carbs > 0 || logged.fat > 0;

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Nutriție</h2>
        <p className="text-xs text-gray-500 mt-0.5">Ținte zilnice & consum</p>
        {targetsHint && (
          <p className="text-[10px] text-violet-400/80 mt-1 max-w-[280px] leading-snug">{targetsHint}</p>
        )}
      </div>

      {/* ── Progres zilnic ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 flex items-center gap-5"
        style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      >
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#2a2f45" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={calPct > 100 ? '#ef4444' : '#7c3aed'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={`${2 * Math.PI * 32 * (1 - clamp(calPct) / 100)}`}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black tabular-nums text-white leading-none">
              {calPct}%
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Calorii</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tabular-nums text-white">{logged.calories}</span>
            <span className="text-sm text-gray-500">/ {calorieTarget} kcal</span>
          </div>
          <span className="text-xs text-gray-500">
            {logged.calories <= calorieTarget
              ? `${calorieTarget - logged.calories} kcal rămase`
              : `${logged.calories - calorieTarget} kcal peste țintă`}
          </span>
          {eatBackKcal > 0 && (
            <span className="text-[10px] text-amber-400/90 mt-0.5">
              +{eatBackKcal} kcal mișcare (țintă de bază {targets.calories})
            </span>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      >
        {(logged.protein + logged.carbs + logged.fat) > 0 && (() => {
          const totalG   = logged.protein + logged.carbs + logged.fat;
          const pPct     = Math.round((logged.protein / totalG) * 100);
          const cPct     = Math.round((logged.carbs   / totalG) * 100);
          const fPct     = 100 - pPct - cPct;
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <span>Raport macro</span>
                <span className="font-normal">{formatMacroGrams(totalG)}g total</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                {pPct > 0 && <div className="bg-blue-500  transition-all" style={{ width: `${pPct}%` }} />}
                {cPct > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${cPct}%` }} />}
                {fPct > 0 && <div className="bg-rose-500  transition-all" style={{ width: `${fPct}%` }} />}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                <span className="flex items-center gap-1 text-blue-400"><span className="w-2 h-2 rounded-sm bg-blue-500"/>Proteine {pPct}%</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-sm bg-amber-500"/>Carbs {cPct}%</span>
                <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-sm bg-rose-500"/>Fats {fPct}%</span>
              </div>
            </div>
          );
        })()}

        <MacroBar label="Proteine" consumed={logged.protein} target={targets.protein} unit="g" color="bg-blue-500" />
        <MacroBar label="Carbs"   consumed={logged.carbs}   target={targets.carbs}   unit="g" color="bg-amber-500" />
        <MacroBar label="Fats"    consumed={logged.fat}     target={targets.fat}     unit="g" color="bg-rose-500" />

        {!hasLogged && (
          <p className="text-center text-gray-500 text-xs py-2 leading-relaxed">
            Nimic logat azi. Adaugă alimente la Mic dejun sau generează un plan mai jos.
          </p>
        )}
      </div>

      {/* ── Logare mese ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Ce ai mâncat azi
        </span>

        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setScanMeal(slot)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                scanMeal === slot
                  ? 'bg-violet-600/30 border-violet-500/50 text-violet-200'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {MEAL_ICONS[slot]} {MEAL_LABELS[slot]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                       bg-violet-600/20 border border-violet-500/40 text-violet-300
                       hover:bg-violet-600/30 active:bg-violet-600/40
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scanning ? 'Analizez…' : '📷 Scan'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        {preview && (
          <div className="relative rounded-xl overflow-hidden border border-gray-700">
            <img src={preview} alt="Previzualizare masă" className="w-full max-h-48 object-cover" />
            {scanning && (
              <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                <span className="text-sm font-semibold text-violet-300 animate-pulse">Analizez…</span>
              </div>
            )}
            {scanStatus === 'ok' && (
              <div className="absolute bottom-0 inset-x-0 bg-green-500/20 border-t border-green-500/40 px-3 py-1.5">
                <p className="text-xs font-semibold text-green-400">
                  ✓ Macro detectate — {MEAL_LABELS[scanMeal]}
                </p>
              </div>
            )}
            {scanStatus === 'err' && (
              <div className="absolute bottom-0 inset-x-0 bg-red-500/20 border-t border-red-500/40 px-3 py-1.5">
                <p className="text-xs font-semibold text-red-400">⚠ Nu am putut analiza — completează manual</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {MEAL_SLOTS.map((slot) => (
            <MealIntakeSection
              key={slot}
              slot={slot}
              label={MEAL_LABELS[slot]}
              icon={MEAL_ICONS[slot]}
              fields={dayMeals[slot]}
              onChange={(fields) => setMealFields(slot, fields)}
              defaultExpanded={slot === 'breakfast'}
              pickerItems={planPickerItems[slot]}
              pickerKey={planPickerKey}
              slotCalorieTarget={slotCalorieTargets[slot]}
            />
          ))}
        </div>

        {(() => {
          const dayPreview = sumDayMeals(storedMealsFromForm(dayMeals));
          return (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500 tabular-nums">
                Total zi:{' '}
                <span className="text-white font-semibold">{dayPreview.calories} kcal</span>
                {' · '}
                {dayPreview.protein}g P · {dayPreview.carbs}g C · {dayPreview.fat}g F
              </p>
              {autoSaveStatus === 'saving' && (
                <span className="text-[11px] text-gray-400 shrink-0">Se salvează…</span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="text-[11px] text-green-400 shrink-0">Salvat ✓</span>
              )}
              {autoSaveStatus === 'err' && (
                <span className="text-[11px] text-red-400 shrink-0">Eroare la salvare</span>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Plan alimentar ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSolveMacros}
        disabled={solving || !canGenerateMealPlan(mealPreferences.allowedIds)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold
                   bg-emerald-600/25 border border-emerald-500/50 text-emerald-200
                   hover:bg-emerald-600/35 active:bg-emerald-600/45
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-testid="generate-meal-plan"
      >
        {solving ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
            </svg>
            Generez planul…
          </>
        ) : (
          <>🧮 Generează plan alimentar</>
        )}
      </button>

      {!canGenerateMealPlan(mealPreferences.allowedIds) && (
        <p className="text-[11px] text-amber-400/90 text-center -mt-3">
          {onOpenProfile ? (
            <>
              <button
                type="button"
                onClick={onOpenProfile}
                className="underline underline-offset-2 hover:text-amber-300"
              >
                Deschide Profile
              </button>
              {' '}pentru a alege alimentele din plan.
            </>
          ) : (
            'Alege alimentele din Profile → Settings.'
          )}
        </p>
      )}

      {solveError && (
        <div className="rounded-xl px-4 py-3 bg-red-900/40 border border-red-500/40">
          <p className="text-xs font-semibold text-red-400">⚠ Eroare plan alimentar</p>
          <p className="text-[11px] text-red-300/70 mt-0.5">{solveError}</p>
        </div>
      )}

      {regenError && (
        <div className="rounded-xl px-4 py-3 bg-red-900/40 border border-red-500/40">
          <p className="text-[11px] text-red-300/70">{regenError}</p>
        </div>
      )}

      {mealPlan && (
        <div
          className="rounded-2xl flex flex-col gap-4 p-4"
          style={{ backgroundColor: '#0f1a12', border: '1px solid #166534' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-300">🧮 Plan alimentar</p>
              <p className="text-[11px] text-emerald-400/60 mt-0.5">
                {mealPlan.daily_totals.calories} kcal · {mealPlan.daily_totals.protein}g P ·{' '}
                {mealPlan.daily_totals.carbs}g C · {mealPlan.daily_totals.fat}g F
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogMealPlan}
              disabled={logging || logStatus === 'ok'}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold
                         bg-emerald-600/30 border border-emerald-500/50 text-emerald-300
                         hover:bg-emerald-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {logStatus === 'ok' ? '✓ Logat' : logging ? 'Loghez…' : '📥 Loghează mesele'}
            </button>
          </div>
          {logStatus === 'err' && (
            <p className="text-[11px] text-red-400">Eroare la logare. Încearcă din nou.</p>
          )}

          {mealPlan.meals.map((meal, mi) => {
            const slot = mealSlotFromPlanName(meal.meal_name);
            return (
              <div
                key={mi}
                className="rounded-xl flex flex-col gap-2 p-3"
                style={{ backgroundColor: '#0a1a0d', border: '1px solid #14532d' }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-emerald-200">{meal.meal_name}</p>
                    <span className="text-[11px] font-semibold text-emerald-400/70 shrink-0">
                      {meal.total_calories} kcal
                    </span>
                  </div>
                  {meal.recipe_name && (
                    <p className="text-[11px] text-emerald-100/90 leading-snug">{meal.recipe_name}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="grid text-[10px] text-gray-500 font-semibold uppercase tracking-wide"
                       style={{ gridTemplateColumns: '1fr 44px 36px 36px 36px 44px' }}>
                    <span>Ingredient</span>
                    <span className="text-right">g</span>
                    <span className="text-right">P</span>
                    <span className="text-right">C</span>
                    <span className="text-right">F</span>
                    <span className="text-right">kcal</span>
                  </div>
                  {meal.ingredients.map((ing, ii) => (
                    <div
                      key={ii}
                      className="grid items-center py-1 border-t border-gray-800/60 text-[11px]"
                      style={{ gridTemplateColumns: '1fr 44px 36px 36px 36px 44px' }}
                    >
                      <span className="text-gray-200 truncate pr-1">{ing.item}</span>
                      <span className="text-right font-bold text-white tabular-nums">{ing.amount_g}g</span>
                      <span className="text-right text-blue-300 tabular-nums">{ing.protein}</span>
                      <span className="text-right text-amber-300 tabular-nums">{ing.carbs}</span>
                      <span className="text-right text-rose-300 tabular-nums">{ing.fat}</span>
                      <span className="text-right text-gray-400 tabular-nums">{ing.calories}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleRegenerateMeal(slot)}
                  disabled={regeneratingSlot === slot}
                  className="self-start px-2.5 py-1 rounded-lg text-[10px] font-semibold
                             bg-emerald-900/40 border border-emerald-700/50 text-emerald-300/90
                             hover:bg-emerald-900/60 disabled:opacity-50"
                >
                  {regeneratingSlot === slot ? 'Schimb…' : '↻ Altă rețetă'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
