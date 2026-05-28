import { useState, useEffect } from 'react';

interface ForecastData {
  isStagnant:       boolean;
  weeklyRateKg:     number;
  currentAvgKg:     number;
  daysRemaining:    number | null;
  projectedDate:    string | null;
  alreadyAtGoal:    boolean;
  insufficientData: boolean;
  goalKg:           number;
  error?:           string;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatRate(rate: number): string {
  const sign = rate <= 0 ? '−' : '+';
  return `${sign}${Math.abs(rate).toFixed(2)} kg/week`;
}

export default function GoalForecaster() {
  const [data, setData]       = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/forecast')
      .then(r => r.json())
      .then(d => setData(d as ForecastData))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-gray-800/60 border border-gray-700 p-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-700 rounded mb-3"/>
        <div className="h-8 w-48 bg-gray-700 rounded"/>
      </div>
    );
  }

  if (!data || data.error) {
    return null;
  }

  // ── Already at goal ──────────────────────────────────────────────────────────
  if (data.alreadyAtGoal) {
    return (
      <div className="rounded-2xl bg-emerald-900/40 border border-emerald-500/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-1">
          Goal Projection
        </p>
        <p className="text-xl font-bold text-emerald-300">🏆 Goal Reached!</p>
        <p className="text-sm text-emerald-400 mt-1">
          Current avg: <span className="font-semibold">{data.currentAvgKg} kg</span> ·
          Target: {data.goalKg} kg
        </p>
      </div>
    );
  }

  // ── Not enough data ──────────────────────────────────────────────────────────
  if (data.insufficientData) {
    return (
      <div className="rounded-2xl bg-gray-800/60 border border-gray-700 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Goal Projection
        </p>
        <p className="text-sm text-gray-400">
          📊 Log weight for at least <span className="text-white font-semibold">4 days</span> to
          unlock your goal projection.
        </p>
      </div>
    );
  }

  // ── Stagnant / gaining ───────────────────────────────────────────────────────
  if (data.isStagnant) {
    return (
      <div className="rounded-2xl bg-amber-900/30 border border-amber-500/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">
          Goal Projection
        </p>
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-200">
              Caloric deficit not detected over the last 14 days.
            </p>
            <p className="text-xs text-amber-400 mt-0.5">
              Cannot project goal date. Current trend:{' '}
              <span className="font-mono font-bold">{formatRate(data.weeklyRateKg)}</span>
            </p>
            <p className="text-xs text-amber-500 mt-2">
              Maintain your deficit to unlock the projection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── On track — show projection ───────────────────────────────────────────────
  const monthsRemaining = data.daysRemaining
    ? Math.round((data.daysRemaining / 30) * 10) / 10
    : null;

  return (
    <div className="rounded-2xl bg-violet-900/30 border border-violet-500/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">
        🎯 Goal Projection · {data.goalKg} kg
      </p>

      {/* Projected date — hero number */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-white leading-tight">
          {data.projectedDate ? formatDate(data.projectedDate) : '—'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {data.daysRemaining != null && (
            <>
              <span className="text-violet-300 font-semibold">{data.daysRemaining} days</span>
              {monthsRemaining != null && monthsRemaining >= 1 && (
                <> · <span className="text-violet-300 font-semibold">{monthsRemaining} months</span></>
              )}
              {' '}remaining
            </>
          )}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-sm">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Current avg</span>
          <span className="font-semibold text-white">{data.currentAvgKg} kg</span>
        </div>
        <div className="w-px bg-gray-700"/>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Weekly rate</span>
          <span className="font-semibold text-emerald-400 font-mono">
            {formatRate(data.weeklyRateKg)}
          </span>
        </div>
        <div className="w-px bg-gray-700"/>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wider">To go</span>
          <span className="font-semibold text-white">
            {(data.currentAvgKg - data.goalKg).toFixed(1)} kg
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {data.currentAvgKg > 0 && (() => {
        // Assume starting weight 15% above goal as baseline for progress bar
        const assumedStart = data.goalKg * 1.15;
        const totalToLose  = Math.max(assumedStart - data.goalKg, 1);
        const lost         = Math.max(assumedStart - data.currentAvgKg, 0);
        const pct          = Math.min(Math.round((lost / totalToLose) * 100), 100);
        return (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      <p className="text-xs text-gray-600 mt-2">
        Based on 14-day moving average · ignores daily water fluctuations
      </p>
    </div>
  );
}
