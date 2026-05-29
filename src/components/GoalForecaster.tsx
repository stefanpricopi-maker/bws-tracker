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

function humanRate(rate: number): string {
  const abs = Math.abs(rate);
  const dir = rate < 0 ? 'Losing' : 'Gaining';
  if (abs < 0.05) return 'Weight holding steady';
  return `${dir} ~${(abs * 1000).toFixed(0)}g per week`;
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
      <div className="rounded-2xl bg-emerald-900/40 border border-emerald-500/50 p-4 flex items-start gap-3">
        <span className="text-3xl leading-none mt-0.5">🏆</span>
        <div>
          <p className="text-base font-bold text-emerald-300">You've reached your goal!</p>
          <p className="text-sm text-emerald-400 mt-1">
            You're at <span className="font-semibold">{data.currentAvgKg} kg</span> — right at your target of {data.goalKg} kg.
            Focus on maintaining this weight.
          </p>
        </div>
      </div>
    );
  }

  // ── Not enough data ──────────────────────────────────────────────────────────
  if (data.insufficientData) {
    return (
      <div className="rounded-2xl bg-gray-800/60 border border-gray-700 p-4 flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">📊</span>
        <div>
          <p className="text-sm font-semibold text-white">Goal tracker not active yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Log your weight on at least <span className="text-white font-semibold">4 days</span> and
            we'll predict when you'll hit {data.goalKg} kg.
          </p>
        </div>
      </div>
    );
  }

  // ── Stagnant / gaining ───────────────────────────────────────────────────────
  if (data.isStagnant) {
    return (
      <div className="rounded-2xl bg-amber-900/30 border border-amber-500/50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-200">
              You haven't been losing weight lately.
            </p>
            <p className="text-xs text-amber-400 mt-1">
              {humanRate(data.weeklyRateKg)} — can't predict a goal date at this pace.
            </p>
            <p className="text-xs text-amber-500/80 mt-2">
              Stick to your calorie target for a few more days to get back on track.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── On track — show projection ───────────────────────────────────────────────
  const daysLeft = data.daysRemaining ?? 0;
  const weeksLeft = Math.round(daysLeft / 7);

  return (
    <div className="rounded-2xl bg-violet-900/30 border border-violet-500/40 p-4 flex flex-col gap-3">

      {/* Hero: destination date */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-violet-400 font-semibold mb-0.5">On track for {data.goalKg} kg 🎯</p>
          <p className="text-xl font-bold text-white leading-tight">
            {data.projectedDate ? formatDate(data.projectedDate) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {weeksLeft > 0
              ? `About ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} away`
              : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} away`}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-500">Still to lose</p>
          <p className="text-lg font-bold text-white">{(data.currentAvgKg - data.goalKg).toFixed(1)} kg</p>
        </div>
      </div>

      {/* Human-readable pace */}
      <div className="rounded-xl bg-violet-900/20 border border-violet-700/30 px-3 py-2">
        <p className="text-xs text-violet-300 font-medium">{humanRate(data.weeklyRateKg)}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">Trend weight now: {data.currentAvgKg} kg · ignores daily water fluctuations</p>
      </div>

      {/* Progress bar */}
      {data.currentAvgKg > 0 && (() => {
        const assumedStart = data.goalKg * 1.15;
        const totalToLose  = Math.max(assumedStart - data.goalKg, 1);
        const lost         = Math.max(assumedStart - data.currentAvgKg, 0);
        const pct          = Math.min(Math.round((lost / totalToLose) * 100), 100);
        return (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Journey progress</span>
              <span className="text-violet-300 font-semibold">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
