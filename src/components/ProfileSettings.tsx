import { useEffect, useState, useRef } from 'react';
import { clearOnboarding } from './Onboarding';
import { proteinGramsForWeight, macrosFromCaloriesAndProtein } from '../lib/macroTargets';
import { calculateTdeeFromWeight } from '../lib/tdee';
import AppPreferences from './AppPreferences';
import MealFoodPreferences from './MealFoodPreferences';
import { defaultMealPreferences, type MealPreferences } from '../lib/mealPreferences';

// ── Types ────────────────────────────────────────────────────────────────────

interface GoalsData {
  targetWeightKg: number | null;
  weeklyWeightLossKg: number | null;
  tdeeKcal: number | null;
  targetCaloriesKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  targetSteps: number | null;
  mealPreferences?: MealPreferences;
}

interface ProfileData {
  name: string;
  createdAt: string;
  goals: GoalsData | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const INPUT_CLS =
  'bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm w-full focus:outline-none focus:border-violet-500 transition-colors';

const SECTION_LABEL = 'text-xs uppercase tracking-widest text-gray-500 mb-3 block font-semibold';

// ── Sub-components ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-800/40 border border-gray-700/40 p-5">
      <span className={SECTION_LABEL}>{title}</span>
      {children}
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-300 font-medium">{label}</label>
      {children}
      {helper && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                  bg-violet-600 text-white text-sm font-semibold
                  px-5 py-3 rounded-full shadow-lg
                  transition-all duration-300
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      Goals saved ✓
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface ProfileSettingsProps {
  onReplayOnboarding?: () => void;
}

export default function ProfileSettings({ onReplayOnboarding }: ProfileSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  // Body goals
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [weeklyLoss, setWeeklyLoss] = useState('0.5');
  const [tdeeKcal, setTdeeKcal] = useState('');

  // Daily targets
  const [targetCalories, setTargetCalories] = useState('1850');
  const [targetProtein, setTargetProtein] = useState('180');
  const [targetCarbs, setTargetCarbs] = useState('113');
  const [targetFat, setTargetFat] = useState('75');
  const [targetSteps, setTargetSteps] = useState('10000');
  const [mealPreferences, setMealPreferences] = useState<MealPreferences>(defaultMealPreferences());

  // TDEE calculator
  const [calcWeight, setCalcWeight] = useState('');
  const [calcHeight, setCalcHeight] = useState('');
  const [calcAge, setCalcAge] = useState('');
  const [calcSex, setCalcSex] = useState<'male' | 'female'>('male');
  const [calcActivity, setCalcActivity] = useState('1.55');

  // Load profile on mount
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setName(d.name ?? '');
        setCreatedAt(d.createdAt ?? '');
        if (d.goals) {
          setTargetWeightKg(d.goals.targetWeightKg != null ? String(d.goals.targetWeightKg) : '');
          setWeeklyLoss(d.goals.weeklyWeightLossKg != null ? String(d.goals.weeklyWeightLossKg) : '0.5');
          setTdeeKcal(d.goals.tdeeKcal != null ? String(d.goals.tdeeKcal) : '');
          setTargetCalories(d.goals.targetCaloriesKcal != null ? String(d.goals.targetCaloriesKcal) : '1850');
          setTargetProtein(d.goals.targetProteinG != null ? String(d.goals.targetProteinG) : '180');
          setTargetCarbs(d.goals.targetCarbsG != null ? String(d.goals.targetCarbsG) : '113');
          setTargetFat(d.goals.targetFatG != null ? String(d.goals.targetFatG) : '75');
          setTargetSteps(d.goals.targetSteps != null ? String(d.goals.targetSteps) : '10000');
          if (d.goals.mealPreferences) {
            setMealPreferences(d.goals.mealPreferences);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function calculateTDEE() {
    const w = parseFloat(calcWeight);
    const h = parseFloat(calcHeight);
    const a = parseFloat(calcAge);
    const act = parseFloat(calcActivity);
    if (!w || !h || !a || !act) return;

    const t = calculateTdeeFromWeight({
      weightKg: w,
      heightCm: h,
      ageYears: a,
      sex: calcSex,
      activityFactor: act,
      weeklyLossKg: parseFloat(weeklyLoss) || 0.5,
    });
    setTdeeKcal(String(t.tdeeKcal));
    setTargetCalories(String(t.targetCalories));
    setTargetProtein(String(t.targetProtein));
    setTargetCarbs(String(t.targetCarbs));
    setTargetFat(String(t.targetFat));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : null,
          weeklyWeightLossKg: parseFloat(weeklyLoss) || 0.5,
          tdeeKcal: tdeeKcal ? parseInt(tdeeKcal, 10) : null,
          targetCaloriesKcal: parseInt(targetCalories, 10) || 1850,
          targetProteinG: parseInt(targetProtein, 10) || 180,
          targetCarbsG: parseInt(targetCarbs, 10) || 113,
          targetFatG: parseInt(targetFat, 10) || 75,
          targetSteps: parseInt(targetSteps, 10) || 10000,
          mealPreferences,
        }),
      });

      setToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-gray-800/40 border border-gray-700/40" />
        ))}
      </div>
    );
  }

  return (
    <>
      <Toast visible={toast} />

      <div className="flex flex-col gap-5 pb-6">
        {/* 1 — User info */}
        <SectionCard title="User Info">
          <div className="flex flex-col gap-4">
            <Field label="Display Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLS}
                placeholder="Your name"
              />
            </Field>
            <Field label="Member Since">
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 text-gray-400 text-sm">
                {createdAt ? fmt(createdAt) : '—'}
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* 2 — Body Goals */}
        <SectionCard title="Body Goals">
          <div className="flex flex-col gap-4">
            <Field label="Target Weight (kg)">
              <input
                type="number"
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
                className={INPUT_CLS}
                placeholder="e.g. 75"
                min="30"
                max="300"
                step="0.1"
              />
            </Field>
            <Field label="Weekly Loss Target">
              <select
                value={weeklyLoss}
                onChange={(e) => setWeeklyLoss(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="0.25">0.25 kg/week (Slow)</option>
                <option value="0.5">0.5 kg/week (Moderate)</option>
                <option value="0.75">0.75 kg/week (Fast)</option>
                <option value="1.0">1.0 kg/week (Aggressive)</option>
              </select>
            </Field>
            <Field label="TDEE (kcal)" helper="Your Total Daily Energy Expenditure">
              <input
                type="number"
                value={tdeeKcal}
                onChange={(e) => setTdeeKcal(e.target.value)}
                className={INPUT_CLS}
                placeholder="e.g. 2300"
                min="1000"
                max="6000"
              />
            </Field>
          </div>
        </SectionCard>

        {/* 3 — Daily Targets */}
        <SectionCard title="Daily Targets">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Calories (kcal)">
              <input
                type="number"
                value={targetCalories}
                onChange={(e) => setTargetCalories(e.target.value)}
                className={INPUT_CLS}
                min="800"
                max="6000"
              />
            </Field>
            <Field label="Protein (g)">
              <input
                type="number"
                value={targetProtein}
                onChange={(e) => setTargetProtein(e.target.value)}
                className={INPUT_CLS}
                min="0"
                max="500"
              />
            </Field>
            <Field label="Carbs (g)">
              <input
                type="number"
                value={targetCarbs}
                onChange={(e) => setTargetCarbs(e.target.value)}
                className={INPUT_CLS}
                min="0"
                max="1000"
              />
            </Field>
            <Field label="Fat (g)">
              <input
                type="number"
                value={targetFat}
                onChange={(e) => setTargetFat(e.target.value)}
                className={INPUT_CLS}
                min="0"
                max="500"
              />
            </Field>
            <Field label="Steps" helper="Daily step goal">
              <input
                type="number"
                value={targetSteps}
                onChange={(e) => setTargetSteps(e.target.value)}
                className={`${INPUT_CLS} col-span-2`}
                min="0"
                max="50000"
                step="500"
              />
            </Field>
          </div>
        </SectionCard>

        {/* 4 — Meal plan food preferences */}
        <MealFoodPreferences
          preferences={mealPreferences}
          onChange={setMealPreferences}
          hideSaveButton
          listMaxHeightClass="max-h-80"
        />

        {/* 5 — TDEE Calculator */}
        <SectionCard title="TDEE Calculator (Mifflin-St Jeor)">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Weight (kg)">
                <input
                  type="number"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="e.g. 80"
                  min="30"
                  max="300"
                  step="0.1"
                />
              </Field>
              <Field label="Height (cm)">
                <input
                  type="number"
                  value={calcHeight}
                  onChange={(e) => setCalcHeight(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="e.g. 178"
                  min="100"
                  max="250"
                />
              </Field>
              <Field label="Age">
                <input
                  type="number"
                  value={calcAge}
                  onChange={(e) => setCalcAge(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="e.g. 28"
                  min="10"
                  max="100"
                />
              </Field>
              <Field label="Sex">
                <select
                  value={calcSex}
                  onChange={(e) => setCalcSex(e.target.value as 'male' | 'female')}
                  className={INPUT_CLS}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            </div>
            <Field label="Activity Level">
              <select
                value={calcActivity}
                onChange={(e) => setCalcActivity(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="1.2">Sedentary (little or no exercise)</option>
                <option value="1.375">Lightly active (1–3 days/week)</option>
                <option value="1.55">Moderately active (3–5 days/week)</option>
                <option value="1.725">Very active (6–7 days/week)</option>
              </select>
            </Field>
            <button
              type="button"
              onClick={calculateTDEE}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl px-5 py-3 transition-colors"
            >
              Calculate TDEE →
            </button>
            {tdeeKcal && (
              <p className="text-sm text-violet-400 font-medium text-center">
                TDEE: {parseInt(tdeeKcal, 10).toLocaleString()} kcal — Target calories updated to{' '}
                {parseInt(targetCalories, 10).toLocaleString()} kcal
              </p>
            )}
          </div>
        </SectionCard>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold rounded-xl px-6 py-3 w-full transition-colors"
        >
          {saving ? 'Saving…' : 'Save Goals & Preferences'}
        </button>

        <AppPreferences />

        {onReplayOnboarding && (
          <SectionCard title="Onboarding">
            <button
              type="button"
              onClick={() => {
                clearOnboarding();
                onReplayOnboarding();
              }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-400 border border-gray-700 hover:text-white hover:border-gray-600 transition-colors"
            >
              Replay onboarding
            </button>
          </SectionCard>
        )}
      </div>
    </>
  );
}
