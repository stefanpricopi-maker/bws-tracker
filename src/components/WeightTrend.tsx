import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────

interface DayEntry {
  date: string;   // 'MMM D'
  raw: number;    // daily weigh-in
}

interface ChartPoint {
  date: string;
  avg: number | null; // 7-day rolling average (null until day 7)
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate 30 days of dummy weight data simulating a slow cut. */
function generateDummyData(): DayEntry[] {
  const START = 88.5;
  const DAILY_DRIFT = -(0.3 / 7);
  const today = new Date();

  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const noise = (Math.random() - 0.5) * 0.9;
    const raw = Math.round((START + DAILY_DRIFT * i + noise) * 10) / 10;
    return { date: label, raw };
  });
}

/**
 * Compute a 7-day rolling average over an array of daily entries.
 * Returns null for the first 6 points (insufficient window).
 */
function rollingAverage(entries: DayEntry[], window = 7): ChartPoint[] {
  return entries.map((entry, i) => {
    if (i < window - 1) return { date: entry.date, avg: null };
    const slice = entries.slice(i - window + 1, i + 1);
    const avg = slice.reduce((sum, e) => sum + e.raw, 0) / window;
    return { date: entry.date, avg: Math.round(avg * 100) / 100 };
  });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

interface TooltipPayload { value?: number }
interface TooltipArgs { active?: boolean; payload?: TooltipPayload[]; label?: string }

function CustomTooltip({ active, payload, label }: TooltipArgs) {
  if (!active || !payload?.length || payload[0]?.value == null) return null;
  return (
    <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-violet-300">{payload[0].value.toFixed(1)} kg</p>
      <p className="text-gray-400 text-xs">{label}</p>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WeightTrend() {
  const [entries, setEntries] = useState<DayEntry[]>(() => generateDummyData());
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const chartData = useMemo(() => rollingAverage(entries), [entries]);

  // Only render points where the average is defined (days 7–30)
  const visibleData = chartData.filter((p) => p.avg !== null);

  const latest = visibleData.at(-1);

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = parseFloat(input);
    if (isNaN(val) || val < 30 || val > 300) {
      setError('Enter a valid weight between 30 and 300 kg.');
      return;
    }
    setError('');

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    setEntries((prev) => {
      const updated = [...prev];
      const last = updated.at(-1);
      // Replace today's entry if it already exists, otherwise append
      if (last?.date === today) {
        updated[updated.length - 1] = { date: today, raw: val };
      } else {
        updated.push({ date: today, raw: val });
        if (updated.length > 30) updated.shift(); // keep window at 30 days
      }
      return updated;
    });
    setInput('');
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Weight Trend</h2>
        <p className="text-xs text-gray-500 mt-0.5">7-day rolling average</p>
      </div>

      {/* Current average pill */}
      {latest?.avg != null && (
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black tabular-nums text-white">
            {latest.avg.toFixed(1)}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-400">kg</span>
            <span className="text-xs text-gray-600">7-day avg</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-2xl bg-gray-800/60 p-4 border border-gray-700/50">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={visibleData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4b5563', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#7c3aed"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Log weight form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Log today's weight
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            min="30"
            max="300"
            placeholder="e.g. 87.4"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-xl bg-gray-800 border border-gray-700
                       px-4 py-3 text-white placeholder-gray-600
                       text-sm focus:outline-none focus:border-violet-500
                       transition-colors"
          />
          <button
            type="submit"
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold
                       text-white transition-colors hover:bg-violet-500 active:bg-violet-700"
          >
            Save
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

    </div>
  );
}
