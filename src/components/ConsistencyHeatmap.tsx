import { useState, useEffect } from 'react';

// ── Thresholds (must match the user's goals) ────────────────────────────────
const CAL_MIN   = 1200;   // below this = under-eating (not ideal)
const CAL_MAX   = 1850;   // above this = surplus (deficit broken)
const STEP_MIN  = 10_000; // NEAT target

// ── Day classification ──────────────────────────────────────────────────────

type DayStatus = 'ideal' | 'active' | 'surplus' | 'empty';

interface DayData {
  date:       string;
  calories:   number | null;
  steps:      number | null;
}

function classify(d: DayData): DayStatus {
  const hasCalories = d.calories !== null && d.calories > 0;
  const hasSteps    = d.steps    !== null;

  const inDeficit = hasCalories && d.calories! >= CAL_MIN && d.calories! <= CAL_MAX;
  const hitSteps  = hasSteps && d.steps! >= STEP_MIN;
  const surplus   = hasCalories && d.calories! > CAL_MAX;

  if (inDeficit && hitSteps) return 'ideal';
  if (hitSteps)              return 'active';
  if (surplus)               return 'surplus';
  return 'empty';
}

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

function calcStreak(days: { date: string; status: DayStatus }[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const s = days[i].status;
    if (s === 'ideal' || s === 'active') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
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
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/logs?days=30')
      .then((r) => r.json())
      .then((rows: LogRow[]) => {
        const logMap = new Map(rows.map((r) => [r.date, r]));
        const dates  = buildDateRange(30);

        const enriched = dates.map((date) => {
          const row = logMap.get(date);
          const data: DayData = {
            date,
            calories: row?.caloriesIn ?? null,
            steps:    row?.steps      ?? null,
          };
          return { date, status: classify(data), data };
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

        {/* Legend */}
        <div className="flex flex-col gap-1 items-end">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Ideal
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Surplus
            </span>
          </div>
          <p className="text-[10px] text-gray-500 text-right">
            {greenCnt}/30 green · {idealCnt} ideal
          </p>
        </div>
      </div>
    </div>
  );
}
