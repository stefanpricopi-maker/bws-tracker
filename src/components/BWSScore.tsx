import { useEffect, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsData {
  currentWeight: number | null;
  weightDelta7d: number | null;
  weightDelta30d: number | null;
  avgCalories7d: number;
  avgProtein7d: number;
  avgSteps7d: number;
  workoutsLast7d: number;
  workoutsLast30d: number;
  streak: number;
  bwsScore: number;
  breakdown: {
    weightProgress: number;
    nutritionScore: number;
    proteinScore: number;
    activityScore: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green-500
  if (score >= 60) return '#f59e0b'; // amber-500
  return '#8b5cf6';                   // violet-500
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-violet-400';
}

function deltaArrow(val: number | null): { symbol: string; color: string } {
  if (val == null || val === 0) return { symbol: '—', color: 'text-gray-400' };
  return val < 0
    ? { symbol: `↓ ${Math.abs(val).toFixed(1)}`, color: 'text-green-400' }
    : { symbol: `↑ ${Math.abs(val).toFixed(1)}`, color: 'text-red-400' };
}

// ── Sub-components ────────────────────────────────────────────────────────

const RING_R = 54;
const RING_STROKE = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function ScoreRing({ score, color }: { score: number; color: string }) {
  const offset = RING_CIRCUMFERENCE * (1 - score / 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="136" height="136" viewBox="0 0 136 136">
        {/* Track */}
        <circle
          cx="68"
          cy="68"
          r={RING_R}
          fill="none"
          stroke="#374151"
          strokeWidth={RING_STROKE}
        />
        {/* Progress arc */}
        <circle
          cx="68"
          cy="68"
          r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 68 68)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* Score text */}
        <text
          x="68"
          y="64"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="28"
          fontWeight="700"
          fill="white"
        >
          {score}
        </text>
        <text
          x="68"
          y="86"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fill="#9ca3af"
        >
          / 100
        </text>
      </svg>
      <p className="text-sm font-semibold text-gray-300 tracking-wide uppercase">BWS Score</p>
    </div>
  );
}

function ScoreRingSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 animate-pulse">
      <div className="w-[136px] h-[136px] rounded-full bg-gray-700/60" />
      <div className="h-4 w-24 rounded bg-gray-700/60" />
    </div>
  );
}

interface BarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

function BreakdownBar({ label, value, max, color }: BarProps) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-400">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-700/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-12 text-right text-xs text-gray-300 tabular-nums">
        {value} / {max}
      </span>
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-28 h-3 rounded bg-gray-700/60" />
          <div className="flex-1 h-2 rounded bg-gray-700/60" />
          <div className="w-12 h-3 rounded bg-gray-700/60" />
        </div>
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: { text: string; color: string };
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-gray-800/60 border border-gray-700/50 px-3 py-3">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-lg font-bold text-white leading-none">{value}</span>
      {sub && <span className={`text-xs font-medium ${sub.color}`}>{sub.text}</span>}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-gray-800/60 border border-gray-700/50 px-3 py-3 animate-pulse">
      <div className="h-2.5 w-16 rounded bg-gray-700/60" />
      <div className="h-6 w-12 rounded bg-gray-700/60" />
      <div className="h-2.5 w-10 rounded bg-gray-700/60" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function BWSScore() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d: AnalyticsData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const color = data ? scoreColor(data.bwsScore) : '#8b5cf6';
  const textColor = data ? scoreTextColor(data.bwsScore) : 'text-violet-400';

  const delta7d = data ? deltaArrow(data.weightDelta7d) : null;
  const delta30d = data ? deltaArrow(data.weightDelta30d) : null;

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-gray-800/40 border border-gray-700/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-base font-semibold ${textColor}`}>Performance Score</h2>
        {data && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
            data.bwsScore >= 80
              ? 'border-green-500/40 text-green-400 bg-green-500/10'
              : data.bwsScore >= 60
                ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                : 'border-violet-500/40 text-violet-400 bg-violet-500/10'
          }`}>
            {data.bwsScore >= 80 ? 'On Track' : data.bwsScore >= 60 ? 'Progressing' : 'Keep Going'}
          </span>
        )}
      </div>

      {/* Hero ring + breakdown */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Ring */}
        {loading ? (
          <ScoreRingSkeleton />
        ) : data ? (
          <ScoreRing score={data.bwsScore} color={color} />
        ) : (
          <ScoreRingSkeleton />
        )}

        {/* Breakdown bars */}
        <div className="flex-1 w-full flex flex-col gap-3">
          {loading || !data ? (
            <BreakdownSkeleton />
          ) : (
            <>
              <BreakdownBar label="Weight Pace" value={data.breakdown.weightProgress} max={25} color={color} />
              <BreakdownBar label="Nutrition" value={data.breakdown.nutritionScore} max={25} color={color} />
              <BreakdownBar label="Protein" value={data.breakdown.proteinScore} max={25} color={color} />
              <BreakdownBar label="Activity" value={data.breakdown.activityScore} max={25} color={color} />
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {loading || !data ? (
          [...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Weight"
              value={data.currentWeight != null ? `${data.currentWeight} kg` : '—'}
            />
            <StatCard
              label="7-day Δ"
              value={delta7d ? delta7d.symbol : '—'}
              sub={delta7d && data.weightDelta7d != null ? { text: 'vs last week', color: delta7d.color } : undefined}
            />
            <StatCard
              label="30-day Δ"
              value={delta30d ? delta30d.symbol : '—'}
              sub={delta30d && data.weightDelta30d != null ? { text: 'vs last month', color: delta30d.color } : undefined}
            />
            <StatCard
              label="Avg Calories"
              value={data.avgCalories7d > 0 ? `${data.avgCalories7d}` : '—'}
              sub={{ text: '7-day avg', color: 'text-gray-500' }}
            />
            <StatCard
              label="Avg Steps"
              value={data.avgSteps7d > 0 ? `${data.avgSteps7d.toLocaleString()}` : '—'}
              sub={{ text: '7-day avg', color: 'text-gray-500' }}
            />
            <StatCard
              label="Streak"
              value={`${data.streak}d`}
              sub={{ text: data.streak >= 7 ? '🔥 Hot streak' : 'consecutive days', color: data.streak >= 7 ? 'text-orange-400' : 'text-gray-500' }}
            />
          </>
        )}
      </div>
    </div>
  );
}
