import { useState, useEffect } from 'react';
import {
  classifyDay as classify,
  calcStreak,
  heatmapThresholdsFromGoals,
} from '../lib/fitness';
import type { DayStatus, DayData, HeatmapThresholds } from '../lib/fitness';

const STATUS_STYLE: Record<DayStatus, { bg: string; label: string }> = {
  ideal:   { bg: 'bg-emerald-500',          label: 'Ideal'   },
  active:  { bg: 'bg-emerald-300',          label: 'Active'  },
  surplus: { bg: 'bg-red-500',              label: 'Surplus' },
  empty:   { bg: 'bg-gray-800 border border-gray-700', label: 'Missed'  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildDateRange(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function shortDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', { weekday: 'narrow' });
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface LogRow {
  date:       string;
  caloriesIn: number | null;
  steps:      number | null;
}

export default function ConsistencyHeatmap() {
  const [days, setDays]       = useState<{ date: string; status: DayStatus; data: DayData }[]>([]);
  const [thresholds, setThresholds] = useState<HeatmapThresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/logs?days=30').then((r) => r.json()),
      fetch('/api/profile').then((r) => r.json()),
    ])
      .then(([rows, profile]: [LogRow[], { goals?: { targetCaloriesKcal?: number; targetSteps?: number } }]) => {
        const t = heatmapThresholdsFromGoals(profile.goals ?? null);
        setThresholds(t);
        const logMap = new Map(rows.map((r) => [r.date, r]));
        const dates  = buildDateRange(30);

        const enriched = dates.map((date) => {
          const row = logMap.get(date);
          const data: DayData = {
            date,
            calories: row?.caloriesIn ?? null,
            steps:    row?.steps      ?? null,
          };
          return { date, status: classify(data, t), data };
        });

        setDays(enriched);
      })
      .catch(() => {
        // On error, show all empty
        setDays(buildDateRange(30).map((date) => ({
          date,
          status: 'empty' as DayStatus,
          data: { date, calories: null, steps: null },
        })));
      })
      .finally(() => setLoading(false));
  }, []);

  const streak   = calcStreak(days);
  const idealCnt = days.filter((d) => d.status === 'ideal').length;
  const greenCnt = days.filter((d) => d.status === 'ideal' || d.status === 'active').length;

  if (loading) {
    return (
      <div className="rounded-2xl bg-gray-800/40 border border-gray-700/40 p-5 flex flex-col gap-3">
        <div className="h-4 w-32 bg-gray-700 rounded animate-pulse" />
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-lg bg-gray-700 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gray-800/40 border border-gray-700/40 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white tracking-wide">Consistency</h2>
        <span className="text-xs text-gray-500">Last 30 days</span>
      </div>

      {/* Heatmap grid — 6 columns × 5 rows */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {days.map(({ date, status, data }) => {
          const { bg } = STATUS_STYLE[status];
          const calStr  = data.calories !== null ? `${data.calories} kcal` : 'no calories';
          const stepStr = data.steps    !== null ? `${data.steps.toLocaleString()} steps` : 'no steps';
          const tip     = `${shortDate(date)} ${shortDay(date)} · ${calStr} · ${stepStr}`;

          return (
            <button
              key={date}
              className={`${bg} rounded-lg aspect-square w-full transition-opacity hover:opacity-80 active:opacity-60 relative`}
              title={tip}
              onMouseEnter={() => setTooltip(tip)}
              onFocus={() => setTooltip(tip)}
              onBlur={() => setTooltip(null)}
              aria-label={tip}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-black/40 select-none">
                {new Date(date).getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <p className="text-[11px] text-gray-400 text-center -mt-1 min-h-[16px] transition-all">
          {tooltip}
        </p>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-gray-900/60 border border-gray-700/50 px-3 py-2.5">
        {([
          { bg: 'bg-emerald-500', label: 'Ideal day',    desc: thresholds ? `${thresholds.calMin}–${thresholds.calMax} kcal + ${thresholds.stepMin.toLocaleString()} steps` : 'On target calories + steps' },
          { bg: 'bg-emerald-300', label: 'Active day',   desc: thresholds ? `${thresholds.stepMin.toLocaleString()}+ steps only` : 'Steps hit' },
          { bg: 'bg-red-500',     label: 'Surplus day',  desc: thresholds ? `Calories above ${thresholds.calMax}` : 'Over calorie target' },
          { bg: 'bg-gray-700',    label: 'Missed',        desc: 'No data logged' },
        ] as const).map(({ bg, label, desc }) => (
          <div key={label} className="flex items-start gap-2">
            <span className={`w-3 h-3 rounded-sm flex-shrink-0 mt-0.5 ${bg}`} />
            <div>
              <p className="text-xs font-semibold text-white leading-tight">{label}</p>
              <p className="text-[10px] text-gray-500 leading-tight">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Streak + stats row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-700/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">{streak >= 7 ? '🔥' : streak >= 3 ? '✅' : streak > 0 ? '🌱' : '💤'}</span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">
              {streak} day{streak !== 1 ? 's' : ''} streak
            </p>
            <p className="text-[10px] text-gray-500">
              {streak === 0 ? 'Start today' : streak < 3 ? 'Keep going' : streak < 7 ? 'Building momentum' : 'On fire!'}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-right">
          <span className="text-emerald-400 font-semibold">{greenCnt}</span>/30 green
          <br /><span className="text-emerald-500 font-semibold">{idealCnt}</span> ideal
        </p>
      </div>
    </div>
  );
}
