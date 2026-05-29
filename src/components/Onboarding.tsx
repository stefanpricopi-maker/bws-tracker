import { useState } from 'react';
import { calculateTdeeFromWeight } from '../lib/tdee';

const STORAGE_KEY = 'bws_onboarding_v1';

interface OnboardingProps {
  onComplete: () => void;
}

interface FormData {
  name:           string;
  currentWeight:  string;
  targetWeight:   string;
  targetCalories: string;
  targetProtein:  string;
}

const DEFAULTS = {
  targetCalories: '1850',
  targetProtein:  '180',
};

export function needsOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== 'done';
}

export function markOnboardingDone() {
  localStorage.setItem(STORAGE_KEY, 'done');
}

/** Clears the onboarding flag so the wizard can run again. */
export function clearOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm]       = useState<FormData>({
    name:           '',
    currentWeight:  '',
    targetWeight:   '',
    targetCalories: DEFAULTS.targetCalories,
    targetProtein:  DEFAULTS.targetProtein,
  });

  const STEPS = [
    { title: 'Welcome to BWS Tracker',  subtitle: 'Math-based fitness. No guesswork.' },
    { title: 'Your body',               subtitle: 'We need a baseline to track progress.' },
    { title: 'Daily targets',           subtitle: 'Defaults follow BWS methodology — adjust anytime in Profile.' },
    { title: "You're all set!",         subtitle: 'Your dashboard is ready.' },
  ];

  function update(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function applyTdeeFromCurrentWeight() {
    const w = Number(form.currentWeight);
    if (!w || w < 30) return;
    const t = calculateTdeeFromWeight({ weightKg: w, weeklyLossKg: 0.5 });
    setForm((f) => ({
      ...f,
      targetCalories: String(t.targetCalories),
      targetProtein:  String(t.targetProtein),
    }));
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const w = Number(form.currentWeight);
      const t = w >= 30 ? calculateTdeeFromWeight({ weightKg: w, weeklyLossKg: 0.5 }) : null;
      await fetch('/api/profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:               form.name.trim() || 'Athlete',
          targetWeightKg:     form.targetWeight  ? Number(form.targetWeight)  : null,
          tdeeKcal:           t?.tdeeKcal ?? null,
          targetCaloriesKcal: Number(form.targetCalories) || t?.targetCalories || 1850,
          targetProteinG:     Number(form.targetProtein)  || t?.targetProtein || 180,
          targetCarbsG:       t?.targetCarbs ?? 113,
          targetFatG:         t?.targetFat ?? 75,
          targetSteps:        10000,
          weeklyWeightLossKg: 0.5,
        }),
      });

      if (form.currentWeight) {
        await fetch('/api/logs', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date:      today,
            weight_kg: Number(form.currentWeight),
          }),
        });
      }

      markOnboardingDone();
      onComplete();
    } catch {
      setError('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function canAdvance(): boolean {
    if (step === 0) return form.name.trim().length >= 1;
    if (step === 1) {
      const w = Number(form.currentWeight);
      return !isNaN(w) && w >= 30 && w <= 300;
    }
    if (step === 2) return true;
    return true;
  }

  const inputCls =
    'rounded-xl bg-gray-800 border border-gray-700 px-4 py-3.5 text-white text-base w-full focus:outline-none focus:border-violet-500 transition-colors placeholder-gray-600';

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-gray-900 overflow-y-auto"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 py-8 gap-6">

        {/* Progress dots */}
        <div className="flex gap-2 justify-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-violet-500' : i < step ? 'w-4 bg-violet-700' : 'w-4 bg-gray-700'}`}
            />
          ))}
        </div>

        {/* Step header */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-white">{STEPS[step].title}</h1>
          <p className="text-sm text-gray-400 mt-2">{STEPS[step].subtitle}</p>
        </div>

        {/* Step content */}
        <div className="flex-1 flex flex-col gap-4">

          {step === 0 && (
            <>
              <div className="rounded-2xl bg-violet-900/20 border border-violet-700/40 p-4 flex flex-col gap-3 text-sm text-gray-300">
                <p>📊 <span className="text-white font-semibold">Track</span> weight, diet, steps & workouts daily</p>
                <p>🏋 <span className="text-white font-semibold">Auto-regulate</span> progressive overload per exercise</p>
                <p>🤖 <span className="text-white font-semibold">AI coach</span> for weekly plans & macro solving</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-400 font-medium">What should we call you?</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  className={inputCls}
                  autoFocus
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-400 font-medium">Current weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  placeholder="e.g. 87.4"
                  value={form.currentWeight}
                  onChange={(e) => update('currentWeight', e.target.value)}
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-400 font-medium">Goal weight (kg) — optional</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  placeholder="e.g. 80"
                  value={form.targetWeight}
                  onChange={(e) => update('targetWeight', e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-600">Used for goal projection on your dashboard</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-400 font-medium">Daily calorie target (kcal)</label>
                <input
                  type="number"
                  min="800"
                  max="5000"
                  value={form.targetCalories}
                  onChange={(e) => update('targetCalories', e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-600">BWS default: 1850 kcal deficit</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-400 font-medium">Daily protein target (g)</label>
                <input
                  type="number"
                  min="50"
                  max="400"
                  value={form.targetProtein}
                  onChange={(e) => update('targetProtein', e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-600">BWS default: 180g — adjust in Profile later</p>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-4 py-4">
              <span className="text-6xl">🎯</span>
              <div className="rounded-2xl bg-gray-800/60 border border-gray-700 w-full p-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="text-white font-semibold">{form.name}</span>
                </div>
                {form.currentWeight && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Starting weight</span>
                    <span className="text-white font-semibold">{form.currentWeight} kg</span>
                  </div>
                )}
                {form.targetWeight && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Goal weight</span>
                    <span className="text-white font-semibold">{form.targetWeight} kg</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Calories / Protein</span>
                  <span className="text-white font-semibold">{form.targetCalories} kcal · {form.targetProtein}g P</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Log weight, meals & workouts daily. Your dashboard will guide you each morning.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-400 border border-gray-700 hover:text-white transition-colors"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canAdvance()}
              onClick={() => {
                if (step === 1) applyTdeeFromCurrentWeight();
                setStep((s) => s + 1);
              }}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Setting up…' : 'Start tracking →'}
            </button>
          )}
        </div>

        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => { markOnboardingDone(); onComplete(); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors text-center"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
