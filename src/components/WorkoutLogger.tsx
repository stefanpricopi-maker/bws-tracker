import { useState, useEffect, useCallback } from 'react';
import { autoRegulate as autoRegulateCalc, calcDeloadWeight } from '../lib/fitness';
import { getExerciseForBlock, EXERCISE_SWAP, MESOCYCLE_WEEKS } from '../lib/periodization';

// ── Types ──────────────────────────────────────────────────────────────────

interface FitSession {
  id: string;
  name: string;
  activityLabel: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMin: number;
  calories: number | null;
}

interface SetInput {
  weight: string;
  reps: string;
  setLabel: string; // e.g. "1", "Activation", "Mini 1"
}

interface ExerciseLog {
  name: string;
  sets: SetInput[];
  lastWeight: number | null;
  lastReps: number | null;
  lastDate: string | null;
  // Auto-regulation targets (Phase 12)
  targetWeight: number | null;
  targetReps: number | null;
  isWeightIncrease: boolean; // true when Rule A applied (+2.5 kg)
  // CNS deload flag (Phase 16)
  needsDeload: boolean;
}

interface DayConfig {
  label: string;
  dayType: string;
  exercises: string[];
  medExercise: string; // primary compound for M.E.D. protocol
  isRest: boolean;
}

// ── 7-Day Hybrid Split ─────────────────────────────────────────────────────

// ── Home-Gym Split (Dumbbells & Bands) ─────────────────────────────────────
// No barbells, cables, or machines required.
const SPLIT: DayConfig[] = [
  {
    label: 'Day 1 — Push',
    dayType: 'Push',
    exercises: [
      'Dumbbell Floor Press',
      'Dumbbell Overhead Press',
      'Deficit Push-ups',
      'Banded Chest Flyes',
      'Dumbbell Lateral Raises',
      'Banded Triceps Pushdowns',
      'Dumbbell Floor Skullcrushers',
    ],
    medExercise: 'Dumbbell Floor Press',
    isRest: false,
  },
  {
    label: 'Day 2 — Pull',
    dayType: 'Pull',
    exercises: [
      'Dumbbell Bent-Over Row',
      'Single-Arm Dumbbell Row',
      'Banded Lat Pulldown',
      'Dumbbell Pullover',
      'Banded Face Pulls',
      'Dumbbell Reverse Flyes',
      'Dumbbell Biceps Curl',
      'Banded Hammer Curl',
    ],
    medExercise: 'Single-Arm Dumbbell Row',
    isRest: false,
  },
  {
    label: 'Day 3 — Legs',
    dayType: 'Legs',
    exercises: [
      'Bulgarian Split Squats',
      'Dumbbell Goblet Squats',
      'Dumbbell Romanian Deadlifts',
      'Single-Leg RDLs',
      'Banded Lying Leg Curls',
      'Single-Leg Calf Raises',
    ],
    medExercise: 'Bulgarian Split Squats',
    isRest: false,
  },
  {
    label: 'Day 4 — Rest',
    dayType: 'Rest',
    exercises: [],
    medExercise: '',
    isRest: true,
  },
  {
    label: 'Day 5 — Upper',
    dayType: 'Upper',
    exercises: [
      'Dumbbell Floor Press',
      'Dumbbell Bent-Over Row',
      'Dumbbell Overhead Press',
      'Dumbbell Lateral Raises',
      'Dumbbell Biceps Curl',
      'Dumbbell Floor Skullcrushers',
    ],
    medExercise: 'Dumbbell Floor Press',
    isRest: false,
  },
  {
    label: 'Day 6 — Legs + Arms',
    dayType: 'Legs+Arms',
    exercises: [
      'Bulgarian Split Squats',
      'Dumbbell Goblet Squats',
      'Dumbbell Reverse Flyes',
      'Dumbbell Biceps Curl',
      'Banded Hammer Curl',
      'Single-Leg Calf Raises',
    ],
    medExercise: 'Bulgarian Split Squats',
    isRest: false,
  },
  {
    label: 'Day 7 — Rest',
    dayType: 'Rest',
    exercises: [],
    medExercise: '',
    isRest: true,
  },
];

// ── Progressive overload badge ─────────────────────────────────────────────

interface Badge {
  label: string;
  color: string;
}

function getBadge(exercise: ExerciseLog, sets: SetInput[]): Badge | null {
  const set1 = sets[0];
  if (!set1 || set1.weight === '') return null;
  if (exercise.lastWeight === null) return null;

  const currentWeight = parseFloat(set1.weight);
  if (isNaN(currentWeight)) return null;

  const currentReps = parseInt(set1.reps, 10);
  const lastReps = exercise.lastReps ?? 0;

  if (currentWeight > exercise.lastWeight) {
    const diff = Math.round((currentWeight - exercise.lastWeight) * 100) / 100;
    return { label: `▲ +${diff} kg`, color: 'text-green-400 bg-green-400/10' };
  }
  if (currentWeight === exercise.lastWeight) {
    if (!isNaN(currentReps) && currentReps > lastReps) {
      const diff = currentReps - lastReps;
      return { label: `▲ +${diff} reps`, color: 'text-green-400 bg-green-400/10' };
    }
    if (!isNaN(currentReps) && currentReps === lastReps) {
      return { label: '→ Same', color: 'text-gray-400 bg-gray-400/10' };
    }
  }
  if (currentWeight < exercise.lastWeight) {
    return { label: '▼ Dropped', color: 'text-red-400 bg-red-400/10' };
  }
  return null;
}

const EMPTY_SETS = (): SetInput[] => [
  { weight: '', reps: '', setLabel: '1' },
  { weight: '', reps: '', setLabel: '2' },
  { weight: '', reps: '', setLabel: '3' },
];

// Myo-Reps: 1 activation set to near-failure + 3 cluster mini-sets
const MYO_SETS = (): SetInput[] => [
  { weight: '', reps: '', setLabel: 'ACT' },
  { weight: '', reps: '', setLabel: 'M1' },
  { weight: '', reps: '', setLabel: 'M2' },
  { weight: '', reps: '', setLabel: 'M3' },
];

/**
 * Phase 12 — Mathematical Auto-Regulation Engine
 *
 * Rule A: maxReps >= 10 → add 2.5 kg, target reps = 8  (weight increase)
 * Rule B: maxReps <  10 → same weight, target reps = maxReps + 1  (rep increase)
 */
const autoRegulate = autoRegulateCalc;

function buildExerciseLogs(day: DayConfig, medMode = false): ExerciseLog[] {
  return buildExerciseLogsForBlock(day, medMode, 1);
}

function buildExerciseLogsForBlock(day: DayConfig, medMode = false, block = 1): ExerciseLog[] {
  const list = medMode && day.medExercise
    ? [day.medExercise]
    : day.exercises;
  return list.map((originalName) => ({
    name: getExerciseForBlock(originalName, block),
    sets: medMode ? MYO_SETS() : EMPTY_SETS(),
    lastWeight: null,
    lastReps: null,
    lastDate: null,
    targetWeight: null,
    targetReps: null,
    isWeightIncrease: false,
    needsDeload: false,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────

interface MesocycleStatus {
  currentBlock:      number;
  blockStartDate:    string;
  weeksElapsed:      number;
  weeksRemaining:    number;
  mesocycleComplete: boolean;
}

export default function WorkoutLogger() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [medMode, setMedMode] = useState(false);
  const [exercises, setExercises] = useState<ExerciseLog[]>(() =>
    buildExerciseLogs(SPLIT[0], false),
  );
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fitSessions, setFitSessions] = useState<FitSession[] | null>(null);
  const [syncingSessions, setSyncingSessions] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [meso, setMeso] = useState<MesocycleStatus | null>(null);
  const [advancingBlock, setAdvancingBlock] = useState(false);

  const fetchPrevStats = useCallback(async (day: DayConfig, isMed: boolean) => {
    if (day.isRest) return;
    setLoadingPrev(true);
    const exerciseNames = isMed && day.medExercise
      ? [day.medExercise]
      : day.exercises;
    try {
      const results = await Promise.all(
        exerciseNames.map((name) =>
          fetch(`/api/workouts?exercise_name=${encodeURIComponent(name)}`)
            .then((r) => r.json())
            .catch(() => ({ lastWeight: null, lastReps: null, lastDate: null, maxWeight: null, maxReps: null, needs_deload: false })),
        ),
      );
      setExercises((prev) =>
        prev.map((ex, i) => {
          const r = results[i] ?? {};
          const needsDeload = r.needs_deload === true;

          let targetWeight: number | null;
          let targetReps:   number | null;
          let isWeightIncrease = false;

          if (needsDeload && r.maxWeight != null) {
            // Phase 16: CNS fatigue — drop 20%, round to nearest 2.5 kg, target 10 reps
            targetWeight     = calcDeloadWeight(r.maxWeight);
            targetReps       = 10;
            isWeightIncrease = false;
          } else {
            // Phase 12: normal auto-regulation (Rule A / Rule B)
            ({ targetWeight, targetReps, isWeightIncrease } = autoRegulate(
              r.maxWeight ?? null,
              r.maxReps   ?? null,
            ));
          }

          // Pre-fill every set with the computed target
          const preFilled = ex.sets.map((s) => ({
            ...s,
            weight: targetWeight !== null ? String(targetWeight) : s.weight,
            reps:   targetReps   !== null ? String(targetReps)   : s.reps,
          }));

          return {
            ...ex,
            lastWeight: r.lastWeight ?? null,
            lastReps:   r.lastReps   ?? null,
            lastDate:   r.lastDate   ?? null,
            targetWeight,
            targetReps,
            isWeightIncrease,
            needsDeload,
            sets: preFilled,
          };
        }),
      );
    } finally {
      setLoadingPrev(false);
    }
  }, []);

  // Rebuild exercise list when day or MED mode changes
  // Fetch mesocycle status once on mount
  useEffect(() => {
    fetch('/api/mesocycle')
      .then(r => r.json())
      .then(d => setMeso(d as MesocycleStatus))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const day = SPLIT[selectedDay];
    const block = meso?.currentBlock ?? 1;
    const fresh = buildExerciseLogsForBlock(day, medMode, block);
    setExercises(fresh);
    fetchPrevStats(day, medMode);
  }, [selectedDay, medMode, fetchPrevStats, meso?.currentBlock]);

  function handleSetChange(
    exIdx: number,
    setIdx: number,
    field: 'weight' | 'reps',
    value: string,
  ) {
    setExercises((prev) => {
      const next = prev.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        const newSets = ex.sets.map((s, si) =>
          si === setIdx ? { ...s, [field]: value } : s,
        );
        return { ...ex, sets: newSets };
      });
      return next;
    });
  }

  async function handleFinish() {
    const day = SPLIT[selectedDay];
    const today = new Date().toISOString().slice(0, 10);

    const sets: Array<{
      exerciseName: string;
      weight: number;
      reps: number;
      setNumber: number;
    }> = [];

    for (const ex of exercises) {
      for (const [si, s] of ex.sets.entries()) {
        if (s.weight === '' && s.reps === '') continue;
        sets.push({
          exerciseName: ex.name,
          weight: parseFloat(s.weight) || 0,
          reps: parseInt(s.reps, 10) || 0,
          setNumber: si + 1,
        });
      }
    }

    if (sets.length === 0) {
      showToast('No sets to save — fill in at least one set first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          dayType: medMode ? `${day.dayType} (M.E.D.)` : day.dayType,
          sets,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      showToast(medMode ? 'M.E.D. session saved! Every rep counts. 💪' : 'Workout saved!');
      setExercises(buildExerciseLogs(day, medMode));
    } catch {
      showToast('Failed to save — please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSyncSessions() {
    setSyncingSessions(true);
    setShowSessions(true);
    try {
      // Fetch last 14 days of sessions
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
      const res = await fetch(`/api/google-fit-sessions?startDate=${start}&endDate=${end}`);
      let data: { error?: string; message?: string } & unknown[] | Record<string, unknown> = [];
      try { data = await res.json(); } catch { throw new Error('Invalid server response'); }
      if (!res.ok) {
        const d = data as { error?: string; message?: string };
        if (d.error === 'not_connected' || d.error === 'token_expired') {
          window.location.href = '/api/auth/google/login';
          return;
        }
        throw new Error(d.message ?? 'Fetch failed');
      }
      setFitSessions(data as unknown[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not fetch Google Fit sessions.');
      setShowSessions(false);
    } finally {
      setSyncingSessions(false);
    }
  }

  async function handleAdvanceBlock() {
    setAdvancingBlock(true);
    try {
      const res = await fetch('/api/mesocycle', { method: 'POST' });
      const data = await res.json() as MesocycleStatus & { message?: string };
      setMeso(prev => prev ? { ...prev, currentBlock: data.currentBlock,
        blockStartDate: data.blockStartDate, weeksElapsed: 0,
        weeksRemaining: MESOCYCLE_WEEKS, mesocycleComplete: false } : null);
      showToast(`🔄 Block ${data.currentBlock} started! Exercises updated.`);
    } catch {
      showToast('Could not advance block. Try again.');
    } finally {
      setAdvancingBlock(false);
    }
  }

  const day = SPLIT[selectedDay];

  return (
    <div className="relative flex flex-col gap-4 pb-28">

      {/* ── Mesocycle complete banner ──────────────────────────────────────── */}
      {meso?.mesocycleComplete && (
        <div className="rounded-2xl bg-violet-900/40 border border-violet-400/60 p-4">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl leading-none">🔄</span>
            <div>
              <p className="font-bold text-violet-200 text-base leading-tight">
                8-Week Mesocycle Complete!
              </p>
              <p className="text-xs text-violet-300 mt-0.5">
                Your muscles have adapted to the current movement patterns.
                Switching exercises targets the same muscles via new motor paths —
                breaking the plateau without deloading.
              </p>
            </div>
          </div>
          <div className="text-xs text-violet-400 mb-3 pl-9">
            <p className="font-semibold mb-1">
              Block {meso.currentBlock} → Block {meso.currentBlock === 1 ? 2 : 1} swaps:
            </p>
            <ul className="space-y-0.5">
              {day.exercises.slice(0, 3).map(ex => {
                const swap = EXERCISE_SWAP[ex];
                if (!swap) return null;
                return (
                  <li key={ex} className="flex items-center gap-1.5">
                    <span className="text-gray-400 line-through">{ex}</span>
                    <span className="text-violet-300">→</span>
                    <span className="text-white font-medium">{swap.block2}</span>
                  </li>
                );
              })}
              {day.exercises.length > 3 && (
                <li className="text-gray-500">+ {day.exercises.length - 3} more…</li>
              )}
            </ul>
          </div>
          <button
            type="button"
            onClick={handleAdvanceBlock}
            disabled={advancingBlock}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                       text-white font-bold py-3 text-sm transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {advancingBlock
              ? 'Updating…'
              : `✅ Initiate Block ${meso.currentBlock === 1 ? 2 : 1}`}
          </button>
        </div>
      )}

      {/* Mesocycle progress indicator (subtle) */}
      {meso && !meso.mesocycleComplete && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-500">
            Block {meso.currentBlock} · Week {meso.weeksElapsed + 1}/{MESOCYCLE_WEEKS}
          </span>
          <div className="flex-1 h-1 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-600/60 transition-all"
              style={{ width: `${((meso.weeksElapsed) / MESOCYCLE_WEEKS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Day selector pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {SPLIT.map((_d, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-150
              ${
                selectedDay === i
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
          >
            {`Day ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Day label + Google Fit sync */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white">{day.label}</h2>
        <button
          onClick={handleSyncSessions}
          disabled={syncingSessions}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 border border-blue-500/30
                     text-blue-400 text-xs font-semibold hover:bg-blue-600/25 active:bg-blue-600/35
                     disabled:opacity-50 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 ${syncingSessions ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncingSessions ? 'Syncing…' : 'Google Fit'}
        </button>
      </div>

      {/* Google Fit sessions panel */}
      {showSessions && (
        <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
            <span className="text-sm font-semibold text-white">Recent Sessions (14 days)</span>
            <button onClick={() => setShowSessions(false)} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
          </div>
          {syncingSessions ? (
            <div className="py-8 text-center text-gray-400 text-sm">Loading sessions…</div>
          ) : fitSessions && fitSessions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No sessions found in Google Fit for the last 14 days.</div>
          ) : fitSessions ? (
            <div className="divide-y divide-gray-700/40">
              {fitSessions.map((s) => {
                const date = new Date(s.startTimeMs);
                const dateStr = date.toLocaleDateString('ro-RO', { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 text-base">
                      {s.activityLabel.toLowerCase().includes('weight') || s.activityLabel.toLowerCase().includes('train') ? '🏋' :
                       s.activityLabel.toLowerCase().includes('run') ? '🏃' :
                       s.activityLabel.toLowerCase().includes('bike') || s.activityLabel.toLowerCase().includes('cycl') ? '🚴' :
                       s.activityLabel.toLowerCase().includes('yoga') ? '🧘' :
                       s.activityLabel.toLowerCase().includes('swim') ? '🏊' : '⚡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{dateStr} · {timeStr}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{s.durationMin} min</p>
                      {s.calories !== null && (
                        <p className="text-xs text-orange-400">{s.calories} kcal</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {/* M.E.D. toggle — only on training days */}
      {!day.isRest && (
        <button
          onClick={() => setMedMode((v) => !v)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200
            ${medMode
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
              : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:border-gray-600 hover:text-gray-300'
            }`}
        >
          {/* Toggle pill */}
          <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0
            ${medMode ? 'bg-amber-500' : 'bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
              ${medMode ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </div>
          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="text-xs font-bold tracking-wide">
              ⚡ Short on Time — M.E.D. Protocol
            </span>
            <span className="text-[10px] leading-tight opacity-70">
              {medMode
                ? `1 compound · Myo-Reps · ~15 min`
                : 'Tap to activate Minimum Effective Dose mode'}
            </span>
          </div>
        </button>
      )}

      {/* M.E.D. disclaimer */}
      {medMode && !day.isRest && (
        <div className="flex gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <span className="text-amber-400 text-sm flex-shrink-0 mt-0.5">ℹ️</span>
          <p className="text-[11px] text-amber-300/70 leading-relaxed">
            <strong className="text-amber-300">M.E.D. preserves muscle mass</strong> when a full session isn't possible.
            One heavy compound with Myo-Reps (activation set → 3 cluster mini-sets, 10s rest between)
            delivers enough stimulus to prevent regression. Always better than skipping entirely.
          </p>
        </div>
      )}

      {/* Rest day message */}
      {day.isRest ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl">😴</span>
          <p className="font-semibold text-white text-lg">Rest Day</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Recovery is where the gains are made. Eat well, sleep well, come back stronger tomorrow.
          </p>
        </div>
      ) : (
        <>
          {/* Exercise cards */}
          {exercises.map((ex, exIdx) => {
            const badge = getBadge(ex, ex.sets);
            return (
            <div key={ex.name} className="bg-gray-800 rounded-2xl border border-gray-700 p-4 flex flex-col gap-3">

              {/* Phase 16: CNS Fatigue / Deload Banner */}
              {!loadingPrev && ex.needsDeload && (
                <div className="rounded-xl px-4 py-3 flex flex-col gap-1 bg-amber-900/60 border border-amber-500/60">
                  <p className="text-xs font-bold text-amber-300 leading-snug">
                    ⚠️ CNS Fatigue Detected
                  </p>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Stagnation over 3 sessions. Auto-Deload initiated (−20% weight).
                    Focus strictly on <span className="font-semibold text-amber-300">form</span> and{' '}
                    <span className="font-semibold text-amber-300">explosive concentric movement</span> today.
                  </p>
                </div>
              )}

              {/* Exercise header */}
              <div>
                {/* Block 2 swap rationale */}
                {meso && meso.currentBlock === 2 && (() => {
                  // Find original Block 1 name by reverse-looking up the swap map
                  const orig = Object.entries(EXERCISE_SWAP).find(([, v]) => v.block2 === ex.name);
                  if (!orig) return null;
                  return (
                    <p className="text-[10px] text-violet-400/80 mb-1 leading-snug">
                      🔄 Block 2 swap from <span className="line-through text-gray-500">{orig[0]}</span>
                      {' '}· <span className="italic">{orig[1].rationale}</span>
                    </p>
                  );
                })()}
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white text-sm">{ex.name}</h3>
                  {medMode && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      M.E.D.
                    </span>
                  )}
                  {/* Phase 16: deload badge (replaces Phase 12 weight-increase badge) */}
                  {ex.needsDeload && !medMode && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      🔻 Deload −20%
                    </span>
                  )}
                  {/* Phase 12: weight-increase indicator (only when no deload) */}
                  {ex.isWeightIncrease && !ex.needsDeload && !medMode && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                      ⬆️ +2.5 kg
                    </span>
                  )}
                  {badge && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-opacity-20 ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-0.5">
                  {loadingPrev
                    ? 'Loading previous...'
                    : ex.lastWeight !== null && ex.lastReps !== null
                    ? `Previous: ${ex.lastWeight} kg × ${ex.lastReps} reps${ex.lastDate ? ` (${ex.lastDate})` : ''}`
                    : 'No previous data'}
                </p>
                {/* Target hint: deload shows amber, normal auto-regulation shows violet */}
                {!loadingPrev && ex.targetWeight !== null && ex.targetReps !== null && !medMode && (
                  <p className={`text-[11px] mt-0.5 font-medium ${ex.needsDeload ? 'text-amber-400' : 'text-violet-400'}`}>
                    {ex.needsDeload ? '🔻' : '🎯'} Target: {ex.targetWeight} kg × {ex.targetReps} reps
                  </p>
                )}
              </div>

              {/* Set rows */}
              <div className="flex flex-col gap-2">
                {/* Column headers */}
                <div className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
                  <span className="text-xs text-gray-500 text-center">Set</span>
                  <span className="text-xs text-gray-500 text-center">Weight (kg)</span>
                  <span className="text-xs text-gray-500 text-center">Reps</span>
                </div>

                {ex.sets.map((s, si) => {
                  const isMiniSet = s.setLabel.startsWith('M');
                  const isActivation = s.setLabel === 'ACT';
                  return (
                    <div key={si}>
                      {/* 10s rest hint before mini-sets */}
                      {isMiniSet && si === 1 && (
                        <p className="text-[10px] text-amber-400/70 text-center mb-1.5">
                          ⏱ 10 sec rest between mini-sets
                        </p>
                      )}
                      <div className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
                        <span className={`text-[10px] font-bold text-center leading-none px-0.5
                          ${isActivation ? 'text-amber-400' : isMiniSet ? 'text-violet-400' : 'text-gray-400'}`}>
                          {s.setLabel}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder={isActivation ? 'heavy' : '0'}
                          value={s.weight}
                          onChange={(e) => handleSetChange(exIdx, si, 'weight', e.target.value)}
                          className={`min-h-[44px] bg-gray-900 rounded-xl text-white text-sm text-center placeholder-gray-600 focus:outline-none transition-colors w-full
                            ${isActivation
                              ? 'border border-amber-500/50 focus:border-amber-400'
                              : isMiniSet
                                ? 'border border-violet-700/50 focus:border-violet-500'
                                : 'border border-gray-700 focus:border-violet-500'
                            }`}
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder={isActivation ? 'fail' : '3–5'}
                          value={s.reps}
                          onChange={(e) => handleSetChange(exIdx, si, 'reps', e.target.value)}
                          className={`min-h-[44px] bg-gray-900 rounded-xl text-white text-sm text-center placeholder-gray-600 focus:outline-none transition-colors w-full
                            ${isActivation
                              ? 'border border-amber-500/50 focus:border-amber-400'
                              : isMiniSet
                                ? 'border border-violet-700/50 focus:border-violet-500'
                                : 'border border-gray-700 focus:border-violet-500'
                            }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </>
      )}

      {/* Floating Finish Workout button */}
      {!day.isRest && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <button
            onClick={handleFinish}
            disabled={isSubmitting}
            className="w-full min-h-[52px] bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                       disabled:opacity-60 disabled:cursor-not-allowed
                       text-white font-bold text-sm rounded-2xl
                       shadow-lg shadow-violet-900/40
                       transition-colors duration-150"
          >
            {isSubmitting ? 'Saving...' : 'Finish Workout'}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50
                        bg-gray-700 text-white text-sm font-medium
                        px-5 py-3 rounded-2xl shadow-xl border border-gray-600
                        animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
