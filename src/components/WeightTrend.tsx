import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { rollingAverage } from '../lib/fitness';
import type { DayEntry, ChartPoint } from '../lib/fitness';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

interface TooltipPayload { value?: number }
interface TooltipArgs { active?: boolean; payload?: TooltipPayload[]; label?: string }

function CustomTooltip({ active, payload, label }: TooltipArgs) {
  if (!active || !payload?.length || payload[0]?.value == null) return null;
  return (
    <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-violet-300">{payload[0].value.toFixed(1)} kg</p>
      <p className="text-gray-400 text-xs">{label ? formatDate(label) : ''}</p>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

// ── Component ──────────────────────────────────────────────────────────────

export default function WeightTrend() {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [input,   setInput]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState<'idle' | 'ok' | 'err'>('idle');
  const [error,   setError]   = useState('');

  // Fetch last 30 days from the API
  useEffect(() => {
    fetch('/api/logs?days=30')
      .then((r) => r.json())
      .then((rows: Array<{ date: string; weightKg: number | null }>) => {
        const parsed: DayEntry[] = rows
          .filter((r): r is { date: string; weightKg: number } => r.weightKg != null)
          .map((r) => ({ date: r.date, weight: r.weightKg }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setEntries(parsed);

        // Pre-fill input with today's weight if already logged
        const todayRow = rows.find((r) => r.date === today());
        if (todayRow?.weightKg != null) setInput(todayRow.weightKg.toString());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData   = useMemo(() => rollingAverage(entries), [entries]);
  const visibleData = chartData.filter((p) => p.avg !== null);
  const latest      = visibleData.at(-1);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = parseFloat(input);
    if (isNaN(val) || val < 30 || val > 300) {
      setError('Enter a valid weight between 30 and 300 kg.');
      return;
    }
    setError('');
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/logs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date: today(), weight_kg: val }),
      });
      if (!res.ok) throw new Error();

      // Optimistic local update
      setEntries((prev) => {
        const updated = prev.filter((e) => e.date !== today());
        return [...updated, { date: today(), weight: val }].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      });
      setStatus('ok');
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Weight Trend</h2>
        <p className="text-xs text-gray-500 mt-0.5">7-day rolling average</p>
      </div>

      {/* Current average */}
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
      <div className="rounded-2xl p-4 border border-gray-700/50" style={{ backgroundColor: 'rgba(30,33,48,0.6)' }}>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-gray-600">
            Loading…
          </div>
        ) : visibleData.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">⚖️</span>
            <p className="text-sm font-semibold text-gray-400">No weight data yet</p>
            <p className="text-xs text-gray-600 text-center max-w-[200px]">
              Log your weight daily — after 7 entries the trend line will appear.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={visibleData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
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
        )}
      </div>

      {/* Log weight form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Log today's weight
        </span>
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
        {error  && <p className="text-xs text-red-400">{error}</p>}
        {status === 'ok'  && <p className="text-xs text-green-400">Saved ✓</p>}
        {status === 'err' && <p className="text-xs text-red-400">Failed to save. Try again.</p>}
      </form>
    </div>
  );
}
