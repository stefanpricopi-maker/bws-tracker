import { useState, useEffect, useRef, useCallback } from 'react';
import { resolveDietTargets } from '../lib/macroTargets';
import MealIntakeSection from './MealIntakeSection';
import MealFoodPreferences from './MealFoodPreferences';
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
  storedMealsFromForm,
  sumDayMeals,
  parseStoredDayMeals,
  dayMealsFormFromStored,
  dayMealsFormFromDailyTotals,
  mealSlotFromPlanName,
  type DayMealsForm,
  type MealSlot,
} from '../lib/mealIntake';

// ── Macro-Solver types ──────────────────────────────────────────────────────
interface MealIngredient {
  item:      string;
  amount_g:  number;
  protein:   number;
  carbs:     number;
  fat:       number;
  calories:  number;
}
interface Meal {
  meal_name:      string;
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
  const remaining = Math.max(0, target - consumed);
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
            {consumed}
          </span>
          <span className="text-gray-600"> / {target}{unit}</span>
          {!over && (
            <span className="text-gray-600"> · {remaining}{unit} left</span>
          )}
          {over && (
            <span className="text-red-400 font-semibold"> +{consumed - target}{unit} over</span>
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

interface WearableSyncResult {
  activeCalories: number;
  steps: number;
}

interface SyncWearableButtonProps {
  onSync: (data: WearableSyncResult) => void;
}

function SyncWearableButton({ onSync }: SyncWearableButtonProps) {
  const [syncing, setSyncing]     = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [synced, setSynced]       = useState(false);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSynced(false);
    try {
      const res = await fetch(`/api/sync/google-fit?date=${today()}`);
      let data: { activeCalories?: number; steps?: number; error?: string; message?: string } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned an invalid response. Try again.');
      }
      if (!res.ok) {
        if (data.error === 'not_connected' || data.error === 'token_expired') {
          window.location.href = '/api/auth/google/login';
          return;
        }
        throw new Error(data.message ?? 'Sync failed');
      }
      onSync({
        activeCalories: data.activeCalories ?? 0,
        steps:          data.steps ?? 0,
      });
      setSynced(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                   bg-violet-600/20 border border-violet-500/40 text-violet-300
                   hover:bg-violet-600/30 active:bg-violet-600/40
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {syncing ? (
          <>
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
            </svg>
            Syncing…
          </>
        ) : synced ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Connected ✓
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Sync Wearable
          </>
        )}
      </button>
      {syncError && <p className="text-xs text-red-400">{syncError}</p>}
    </div>
  );
}

export default function DietTracker() {
  const [logged, setLogged]   = useState<Intake>(EMPTY);
  const [dayMeals, setDayMeals] = useState<DayMealsForm>({ ...EMPTY_DAY_MEALS });
  const [scanMeal, setScanMeal] = useState<MealSlot>('breakfast');
  const [saving, setSaving]   = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'err'>('idle');
  const [scanning, setScanning]   = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [preview, setPreview]     = useState<string | null>(null);
  const [wearableSync, setWearableSync] = useState<WearableSyncResult | null>(null);
  const [targets, setTargets]         = useState(DEFAULT_TARGETS);
  const [targetsHint, setTargetsHint] = useState('');
  // Macro-Solver state
  const [solving, setSolving]       = useState(false);
  const [mealPlan, setMealPlan]     = useState<MealPlan | null>(null);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [logging, setLogging]       = useState(false);
  const [logStatus, setLogStatus]   = useState<'idle' | 'ok' | 'err'>('idle');
  const [mealPreferences, setMealPreferences] = useState<MealPreferences>(defaultMealPreferences);
  const [prefSaving, setPrefSaving]         = useState(false);
  const [prefSaveStatus, setPrefSaveStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleWearableSync = useCallback((data: WearableSyncResult) => setWearableSync(data), []);

  function setMealFields(slot: MealSlot, fields: DayMealsForm[MealSlot]) {
    setDayMeals((m) => ({ ...m, [slot]: fields }));
  }

  async function saveDayMeals(mealsForm: DayMealsForm) {
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
  }

  async function saveMealPreferences(): Promise<boolean> {
    setPrefSaving(true);
    setPrefSaveStatus('idle');
    try {
      const res = await fetch('/api/profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mealPreferences }),
      });
      if (!res.ok) throw new Error('Save failed');
      setPrefSaveStatus('ok');
      return true;
    } catch {
      setPrefSaveStatus('err');
      return false;
    } finally {
      setPrefSaving(false);
    }
  }

  async function handleSolveMacros() {
    if (!canGenerateMealPlan(mealPreferences.allowedIds)) {
      setSolveError(`Selectează cel puțin ${MIN_ALLOWED_FOODS} alimente în lista de mai jos.`);
      return;
    }
    setSolving(true);
    setSolveError(null);
    setMealPlan(null);
    setLogStatus('idle');
    try {
      const saved = await saveMealPreferences();
      if (!saved) throw new Error('Nu am putut salva preferințele.');
      const res  = await fetch('/api/macro-solver');
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error');
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
      for (const meal of mealPlan.meals) {
        const slot = mealSlotFromPlanName(meal.meal_name);
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
      setDayMeals(nextForm);
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
        if (profile.goals?.mealPreferences) {
          setMealPreferences(profile.goals.mealPreferences);
        }
        if (latestWeight) {
          setTargetsHint(`Protein target: ${t.protein}g (${latestWeight} kg × 1.8 g/kg). Edit in Profile.`);
        } else {
          setTargetsHint('Log weight in Stats to personalize protein target (1.8 g/kg).');
        }

        const todayRow = rows.find((r) => r.date === today());
        if (todayRow) {
          const totals = {
            calories: todayRow.calories_in ?? 0,
            protein:  todayRow.protein_g   ?? 0,
            carbs:    todayRow.carbs_g     ?? 0,
            fat:      todayRow.fat_g       ?? 0,
          };
          applyLoggedTotals(setLogged, totals);
          if (todayRow.meals) {
            setDayMeals(dayMealsFormFromStored(todayRow.meals));
          } else {
            setDayMeals(dayMealsFormFromDailyTotals(totals));
          }
        }
      })
      .catch(() => {});
  }, []);

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

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatus('idle');
    try {
      await saveDayMeals(dayMeals);
      setStatus('ok');
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  }

  const calPct = pct(logged.calories, targets.calories);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Nutrition</h2>
        <p className="text-xs text-gray-500 mt-0.5">Daily targets & intake</p>
        {targetsHint && (
          <p className="text-[10px] text-violet-400/80 mt-1 max-w-[280px] leading-snug">{targetsHint}</p>
        )}
      </div>

      <MealFoodPreferences
        preferences={mealPreferences}
        onChange={(prefs) => {
          setMealPreferences(prefs);
          setPrefSaveStatus('idle');
        }}
        onSave={saveMealPreferences}
        saving={prefSaving}
        saveStatus={prefSaveStatus}
      />

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
          <>🧮 Generează plan AI</>
        )}
      </button>

      {/* Calorie ring-style hero */}
      <div
        className="rounded-2xl p-5 flex items-center gap-5"
        style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      >
        {/* Circular progress (SVG) */}
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            {/* track */}
            <circle cx="40" cy="40" r="32" fill="none" stroke="#2a2f45" strokeWidth="8" />
            {/* progress */}
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
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Calories</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tabular-nums text-white">{logged.calories}</span>
            <span className="text-sm text-gray-500">/ {targets.calories} kcal</span>
          </div>
          <span className="text-xs text-gray-500">
            {logged.calories <= targets.calories
              ? `${targets.calories - logged.calories} kcal remaining`
              : `${logged.calories - targets.calories} kcal over target`}
          </span>
        </div>
      </div>

      {/* Macro progress bars */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      >
        {/* Macro split proportional bar */}
        {(logged.protein + logged.carbs + logged.fat) > 0 && (() => {
          const totalG   = logged.protein + logged.carbs + logged.fat;
          const pPct     = Math.round((logged.protein / totalG) * 100);
          const cPct     = Math.round((logged.carbs   / totalG) * 100);
          const fPct     = 100 - pPct - cPct;
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <span>Macro split</span>
                <span className="font-normal">{totalG}g total</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                {pPct > 0 && <div className="bg-blue-500  transition-all" style={{ width: `${pPct}%` }} title={`Protein ${pPct}%`} />}
                {cPct > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${cPct}%` }} title={`Carbs ${cPct}%`} />}
                {fPct > 0 && <div className="bg-rose-500  transition-all" style={{ width: `${fPct}%` }} title={`Fat ${fPct}%`} />}
              </div>
              <div className="flex gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-blue-400"><span className="w-2 h-2 rounded-sm bg-blue-500"/>P {pPct}%</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-sm bg-amber-500"/>C {cPct}%</span>
                <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-sm bg-rose-500"/>F {fPct}%</span>
              </div>
            </div>
          );
        })()}

        <MacroBar label="Protein" consumed={logged.protein} target={targets.protein} unit="g" color="bg-blue-500" />
        <MacroBar label="Carbs"   consumed={logged.carbs}   target={targets.carbs}   unit="g" color="bg-amber-500" />
        <MacroBar label="Fat"     consumed={logged.fat}     target={targets.fat}     unit="g" color="bg-rose-500" />

        {/* Nothing logged yet — empty state */}
        {logged.calories === 0 && logged.protein === 0 && logged.carbs === 0 && logged.fat === 0 && (
          <p className="text-center text-gray-500 text-xs py-2">
            No intake logged today. Log each meal below or use Solve Macros.
          </p>
        )}
      </div>

      {solveError && (
        <div className="rounded-xl px-4 py-3 bg-red-900/40 border border-red-500/40">
          <p className="text-xs font-semibold text-red-400">⚠ Macro solver error</p>
          <p className="text-[11px] text-red-300/70 mt-0.5">{solveError}</p>
        </div>
      )}

      {/* ── AI Meal Plan card ──────────────────────────────────────── */}
      {mealPlan && (
        <div
          className="rounded-2xl flex flex-col gap-4 p-4"
          style={{ backgroundColor: '#0f1a12', border: '1px solid #166534' }}
        >
          {/* Plan header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-300">🧮 AI Meal Plan</p>
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
              {logStatus === 'ok'
                ? '✓ Logged'
                : logging
                ? 'Logging…'
                : '📥 Log These Meals'}
            </button>
          </div>
          {logStatus === 'err' && (
            <p className="text-[11px] text-red-400">Failed to log. Try again.</p>
          )}

          {/* Meal cards */}
          {mealPlan.meals.map((meal, mi) => (
            <div
              key={mi}
              className="rounded-xl flex flex-col gap-2 p-3"
              style={{ backgroundColor: '#0a1a0d', border: '1px solid #14532d' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-200">{meal.meal_name}</p>
                <span className="text-[11px] font-semibold text-emerald-400/70">
                  {meal.total_calories} kcal
                </span>
              </div>

              {/* Ingredient rows */}
              <div className="flex flex-col gap-1">
                {/* Column headers */}
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
            </div>
          ))}
        </div>
      )}

      {/* Google Fit activity banner (shown after wearable sync) */}
      {wearableSync !== null && (() => {
        const { activeCalories, steps } = wearableSync;
        // Eat-back only for unusually high movement days (not normal morning NEAT).
        const eatBack     = Math.min(Math.round(activeCalories * 0.5), 500);
        const adjustedTarget = targets.calories + eatBack;
        const isHigh      = activeCalories >= 600;

        return (
          <div
            className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
            style={{ backgroundColor: '#1f1a0e', border: '1px solid #78350f' }}
          >
            <p className="text-xs font-semibold text-amber-400">
              Google Fit — mișcare de azi: {activeCalories.toLocaleString()} kcal
            </p>
            <p className="text-[11px] text-amber-300/60 leading-relaxed">
              De la miezul nopții, nu doar antrenament. Google Fit estimează din pași,
              ceas (Huawei → Health Sync) și activitate generală — la 10:40 poate include
              tot ce ai făcut dimineața (mers, treburii).
              {steps > 0 && (
                <> Pași sincronizați: <span className="font-semibold text-amber-300/80">{steps.toLocaleString()}</span>.</>
              )}
            </p>
            {isHigh ? (
              <>
                <p className="text-xs text-amber-300/80">
                  Zi cu multă mișcare. Mănâncă înapoi ~50% ({eatBack} kcal) dacă vrei — țintă sugerată:{' '}
                  <span className="font-bold text-amber-300">{adjustedTarget.toLocaleString()} kcal</span>.
                </p>
                <p className="text-[10px] text-amber-300/40">
                  Verifică în app-ul Google Fit aceeași valoare; uneori ceasul supraestimează.
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-300/70">
                Sub pragul de ajustare (600 kcal). Ținta rămâne{' '}
                <span className="font-bold text-amber-300">{targets.calories.toLocaleString()} kcal</span>
                {' '}— nu e nevoie să compensezi dimineața obișnuită.
              </p>
            )}
          </div>
        );
      })()}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Section header + scan button */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Ce ai mâncat azi
          </span>
          <SyncWearableButton onSync={handleWearableSync} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Scan pentru:</span>
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setScanMeal(slot)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
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
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                       bg-violet-600/20 border border-violet-500/40 text-violet-300
                       hover:bg-violet-600/30 active:bg-violet-600/40
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scanning ? 'Scanning…' : '📷 Scan'}
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

        {/* Image preview + scan feedback */}
        {preview && (
          <div className="relative rounded-xl overflow-hidden border border-gray-700">
            <img src={preview} alt="Meal preview" className="w-full max-h-48 object-cover" />
            {scanning && (
              <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                <span className="text-sm font-semibold text-violet-300 animate-pulse">Analyzing…</span>
              </div>
            )}
            {scanStatus === 'ok' && (
              <div className="absolute bottom-0 inset-x-0 bg-green-500/20 border-t border-green-500/40 px-3 py-1.5">
                <p className="text-xs font-semibold text-green-400">
                  ✓ Macros detectate — {MEAL_LABELS[scanMeal]}
                </p>
              </div>
            )}
            {scanStatus === 'err' && (
              <div className="absolute bottom-0 inset-x-0 bg-red-500/20 border-t border-red-500/40 px-3 py-1.5">
                <p className="text-xs font-semibold text-red-400">⚠ Could not analyze image — fill manually</p>
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
            />
          ))}
        </div>

        {(() => {
          const preview = sumDayMeals(storedMealsFromForm(dayMeals));
          return (
            <p className="text-center text-[11px] text-gray-500 tabular-nums">
              Total zi:{' '}
              <span className="text-white font-semibold">{preview.calories} kcal</span>
              {' · '}
              {preview.protein}g P · {preview.carbs}g C · {preview.fat}g F
            </p>
          );
        })()}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white
                     transition-colors hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Se salvează…' : 'Salvează ziua'}
        </button>

        {status === 'ok'  && <p className="text-xs text-green-400 text-center">Saved ✓</p>}
        {status === 'err' && <p className="text-xs text-red-400  text-center">Failed to save. Try again.</p>}
      </form>
    </div>
  );
}
