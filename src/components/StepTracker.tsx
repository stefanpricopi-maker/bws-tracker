import { useState, useEffect } from 'react';
import { formatActivitySyncBanner } from '../lib/fitness';
import { cacheActivitySync } from '../lib/activitySync';

const STEP_TARGET = 10_000;
const DEFAULT_CAL_TARGET = 1850;
const today = () => new Date().toISOString().slice(0, 10);

interface SyncResult {
  steps: number;
  activeCalories: number;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

interface SyncButtonProps {
  onSync: (data: SyncResult) => void;
}

function SyncButton({ onSync }: SyncButtonProps) {
  const [syncing, setSyncing]     = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [synced, setSynced]       = useState(false);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSynced(false);
    try {
      const res = await fetch(`/api/sync/google-fit?date=${today()}`);
      let data: { steps?: number; activeCalories?: number; error?: string; message?: string } = {};
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
        steps:          data.steps ?? 0,
        activeCalories: data.activeCalories ?? 0,
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

export default function StepTracker() {
  const [steps,  setSteps]  = useState(0);
  const [input,  setInput]  = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [calTarget, setCalTarget] = useState(DEFAULT_CAL_TARGET);
  const [activityBanner, setActivityBanner] = useState<{ line1: string; line2: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/logs?days=1').then((r) => r.json()),
      fetch('/api/profile').then((r) => r.json()),
    ])
      .then(([rows, profile]: [
        Array<{ date: string; steps: number | null }>,
        { goals?: { targetCaloriesKcal?: number | null } | null },
      ]) => {
        const row = rows.find((r) => r.date === today());
        if (row?.steps != null) {
          setSteps(row.steps);
          setInput(row.steps.toString());
        }
        const cals = profile.goals?.targetCaloriesKcal;
        if (cals != null && cals > 0) setCalTarget(cals);
      })
      .catch(() => {});
  }, []);

  function handleWearableSync({ steps: syncedSteps, activeCalories }: SyncResult) {
    setSteps(syncedSteps);
    setInput(syncedSteps.toString());
    setActivityBanner(formatActivitySyncBanner(activeCalories, syncedSteps, calTarget));
    cacheActivitySync({ date: today(), activeCalories, steps: syncedSteps });
  }

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
            {steps === 0
              ? 'Sync wearable or log steps manually below'
              : isAchieved
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

      {activityBanner && (
        <div
          className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
          style={{ backgroundColor: '#1f1a0e', border: '1px solid #78350f' }}
        >
          <p className="text-xs font-semibold text-amber-300">{activityBanner.line1}</p>
          <p className="text-[11px] text-amber-300/75">{activityBanner.line2}</p>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Log today's steps
          </span>
          <SyncButton onSync={handleWearableSync} />
        </div>
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
