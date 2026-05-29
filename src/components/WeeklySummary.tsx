import { useState, useEffect } from 'react';

interface WeeklySummaryData {
  weekStart: string;
  weekEnd: string;
  weightLostKg: number | null;
  workoutCount: number;
  daysTrained: number;
  calorieAdherence: number;
  proteinAdherence: number;
  bestExercise: { name: string; volumeDelta: number } | null;
  summaryText: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface StatPillProps {
  label: string;
  value: string;
  sub?: string;
}

function StatPill({ label, value, sub }: StatPillProps) {
  return (
    <div className="bg-gray-900/60 rounded-xl p-3 flex flex-col gap-0.5">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-base font-bold text-white leading-tight">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

export default function WeeklySummary() {
  const isMonday = new Date().getDay() === 1;
  const [expanded, setExpanded] = useState(isMonday);
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/weekly-summary')
      .then((r) => r.json())
      .then((d: WeeklySummaryData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data) {
    return (
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-2xl leading-none">📅</span>
        <div>
          <p className="text-sm font-semibold text-gray-300">Weekly Summary</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Start logging your meals, steps, and workouts and your weekly recap will appear here.
          </p>
        </div>
      </div>
    );
  }

  const weightLabel =
    data.weightLostKg == null
      ? '—'
      : data.weightLostKg > 0
        ? `-${data.weightLostKg} kg`
        : data.weightLostKg < 0
          ? `+${Math.abs(data.weightLostKg)} kg`
          : '0 kg';

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full bg-transparent border-0 cursor-pointer p-0 text-left"
      >
        <div>
          <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">
            Weekly Summary
          </span>
          <p className="text-sm font-bold text-white mt-0.5">
            Week of {formatDate(data.weekStart)}
          </p>
        </div>
        <span
          className={`text-gray-400 text-lg leading-none transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          ›
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="flex flex-col gap-3">
          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatPill
              label="Weight Lost"
              value={weightLabel}
              sub="this week"
            />
            <StatPill
              label="Workouts"
              value={String(data.workoutCount)}
              sub={`${data.daysTrained} day${data.daysTrained !== 1 ? 's' : ''} trained`}
            />
            <StatPill
              label="Calorie Adherence"
              value={`${data.calorieAdherence}%`}
              sub="≥80% of target"
            />
            <StatPill
              label="Protein Adherence"
              value={`${data.proteinAdherence}%`}
              sub="≥90% of target"
            />
          </div>

          {/* Best exercise */}
          {data.bestExercise && (
            <p className="text-sm text-green-400 font-semibold">
              💪 PR: {data.bestExercise.name} (+{data.bestExercise.volumeDelta.toLocaleString()} kg volume)
            </p>
          )}

          {/* Summary text */}
          <p className="text-xs text-gray-500 italic leading-relaxed">{data.summaryText}</p>
        </div>
      )}
    </div>
  );
}
