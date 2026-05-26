import { useState, useEffect } from 'react';

const STEP_TARGET = 10_000;
const today = () => new Date().toISOString().slice(0, 10);

function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

export default function StepTracker() {
  const [steps,  setSteps]  = useState(0);
  const [input,  setInput]  = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  // Load today's step count on mount
  useEffect(() => {
    fetch('/api/logs?days=1')
      .then((r) => r.json())
      .then((rows: Array<{ date: string; steps: number | null }>) => {
        const row = rows.find((r) => r.date === today());
        if (row?.steps != null) {
          setSteps(row.steps);
          setInput(row.steps.toString());
        }
      })
      .catch(() => {});
  }, []);

  const progress   = clamp(Math.round((steps / STEP_TARGET) * 100));
  const isAchieved = steps >= STEP_TARGET;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = parseInt(input, 10);
    if (isNaN(val) || val < 0) return;

    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/logs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date: today(), steps: val }),
      });
      if (!res.ok) throw new Error();
      setSteps(val);
      setStatus('ok');
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Steps · NEAT</h2>
        <p className="text-xs text-gray-500 mt-0.5">Daily movement target</p>
      </div>

      {/* Hero counter */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{ backgroundColor: '#1a1d27', border: `1px solid ${isAchieved ? '#16a34a' : '#2a2f45'}` }}
      >
        <div className="flex items-end gap-2">
          <span className="text-5xl font-black tabular-nums" style={{ color: isAchieved ? '#22c55e' : '#fff' }}>
            {steps.toLocaleString()}
          </span>
          <span className="text-base text-gray-500 pb-1">/ {STEP_TARGET.toLocaleString()} steps</span>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:           `${progress}%`,
              backgroundColor: isAchieved ? '#22c55e' : '#7c3aed',
            }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span style={{ color: isAchieved ? '#22c55e' : '#6b7280' }}>
            {isAchieved
              ? `🎯 Goal achieved! +${(steps - STEP_TARGET).toLocaleString()} bonus`
              : `${(STEP_TARGET - steps).toLocaleString()} steps to go`}
          </span>
          <span className="font-semibold" style={{ color: isAchieved ? '#22c55e' : '#a78bfa' }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Calorie burn estimate (physics-based: ~0.04 kcal/step for ~75 kg person) */}
      {steps > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between text-sm"
          style={{ backgroundColor: '#21253a', border: '1px solid #2a2f45' }}
        >
          <span className="text-gray-400">Est. NEAT burn</span>
          <span className="font-bold text-white">{Math.round(steps * 0.04)} kcal</span>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Log today's steps
        </span>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            max="100000"
            step="1"
            placeholder="e.g. 8500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-xl bg-gray-800 border border-gray-700
                       px-4 py-3 text-white placeholder-gray-600 text-sm
                       focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white
                       transition-colors hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
        {status === 'ok'  && <p className="text-xs text-green-400">Saved ✓</p>}
        {status === 'err' && <p className="text-xs text-red-400">Failed to save. Try again.</p>}
      </form>
    </div>
  );
}
