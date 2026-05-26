import { useState, useEffect } from 'react';

// ── Targets ────────────────────────────────────────────────────────────────
const TARGETS = {
  calories: 1850,
  protein:  180,
  fat:       75,
  carbs:    113,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

function pct(consumed: number, target: number) {
  return clamp(Math.round((consumed / target) * 100));
}

const today = () => new Date().toISOString().slice(0, 10);

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

export default function DietTracker() {
  const [logged, setLogged]   = useState<Intake>(EMPTY);
  const [form,   setForm]     = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [saving, setSaving]   = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'err'>('idle');

  // Load today's data on mount
  useEffect(() => {
    fetch('/api/logs?days=1')
      .then((r) => r.json())
      .then((rows: Array<{ date: string; caloriesIn: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }>) => {
        const todayRow = rows.find((r) => r.date === today());
        if (todayRow) {
          setLogged({
            calories: todayRow.caloriesIn ?? 0,
            protein:  todayRow.proteinG   ?? 0,
            carbs:    todayRow.carbsG     ?? 0,
            fat:      todayRow.fatG       ?? 0,
          });
          setForm({
            calories: todayRow.caloriesIn?.toString() ?? '',
            protein:  todayRow.proteinG?.toString()   ?? '',
            carbs:    todayRow.carbsG?.toString()     ?? '',
            fat:      todayRow.fatG?.toString()       ?? '',
          });
        }
      })
      .catch(() => {/* silently fail — network may be unavailable in dev */});
  }, []);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:         today(),
          calories_in:  Number(form.calories) || null,
          protein_g:    Number(form.protein)  || null,
          carbs_g:      Number(form.carbs)    || null,
          fat_g:        Number(form.fat)      || null,
        }),
      });
      if (!res.ok) throw new Error('API error');
      setLogged({
        calories: Number(form.calories) || 0,
        protein:  Number(form.protein)  || 0,
        carbs:    Number(form.carbs)    || 0,
        fat:      Number(form.fat)      || 0,
      });
      setStatus('ok');
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  }

  const calPct = pct(logged.calories, TARGETS.calories);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Nutrition</h2>
        <p className="text-xs text-gray-500 mt-0.5">Daily targets & intake</p>
      </div>

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
            <span className="text-sm text-gray-500">/ {TARGETS.calories} kcal</span>
          </div>
          <span className="text-xs text-gray-500">
            {logged.calories <= TARGETS.calories
              ? `${TARGETS.calories - logged.calories} kcal remaining`
              : `${logged.calories - TARGETS.calories} kcal over target`}
          </span>
        </div>
      </div>

      {/* Macro progress bars */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      >
        <MacroBar label="Protein" consumed={logged.protein} target={TARGETS.protein} unit="g" color="bg-blue-500" />
        <MacroBar label="Carbs"   consumed={logged.carbs}   target={TARGETS.carbs}   unit="g" color="bg-amber-500" />
        <MacroBar label="Fat"     consumed={logged.fat}     target={TARGETS.fat}     unit="g" color="bg-rose-500" />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Log today's intake
        </span>

        <div className="grid grid-cols-2 gap-2">
          {([ ['calories', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'] ] as [keyof typeof form, string][]).map(
            ([key, placeholder]) => (
              <input
                key={key}
                type="number"
                min="0"
                step={key === 'calories' ? '1' : '0.1'}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-3
                           text-white placeholder-gray-600 text-sm
                           focus:outline-none focus:border-violet-500 transition-colors"
              />
            )
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white
                     transition-colors hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Intake'}
        </button>

        {status === 'ok'  && <p className="text-xs text-green-400 text-center">Saved ✓</p>}
        {status === 'err' && <p className="text-xs text-red-400  text-center">Failed to save. Try again.</p>}
      </form>
    </div>
  );
}
