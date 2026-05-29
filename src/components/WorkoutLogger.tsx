import { useState, useEffect, useCallback, useRef } from 'react';
import { autoRegulate as autoRegulateCalc, calcDeloadWeight, weightIncrementKg } from '../lib/fitness';
import { getExerciseForBlock, EXERCISE_SWAP, MESOCYCLE_WEEKS, deloadSetCount } from '../lib/periodization';
import { isBandedExercise, formatExerciseLoad, formatBandLevel } from '../lib/exerciseKind';
import type { PlannedExercise } from './WorkoutPlayer';
import ExerciseManager from './ExerciseManager';

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

/** Creates `n` empty set rows (default 3). Labels are 1-based integers. */
const MAKE_SETS = (n = 3): SetInput[] =>
  Array.from({ length: n }, (_, i) => ({ weight: '', reps: '', setLabel: String(i + 1) }));

const DEFAULT_WORKING_SETS = 3;
const EMPTY_SETS = (isDeloadWeek = false): SetInput[] =>
  MAKE_SETS(isDeloadWeek ? deloadSetCount(DEFAULT_WORKING_SETS) : DEFAULT_WORKING_SETS);

// Myo-Reps: 1 activation set to near-failure + 3 cluster mini-sets (deload: ACT + 1 mini)
const MYO_SETS = (isDeloadWeek = false): SetInput[] =>
  isDeloadWeek
    ? [
        { weight: '', reps: '', setLabel: 'ACT' },
        { weight: '', reps: '', setLabel: 'M1' },
      ]
    : [
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

function buildExerciseLogsForBlock(
  day: DayConfig,
  medMode = false,
  block = 1,
  isDeloadWeek = false,
): ExerciseLog[] {
  const list = medMode && day.medExercise
    ? [day.medExercise]
    : day.exercises;
  return list.map((originalName) => ({
    name: getExerciseForBlock(originalName, block),
    sets: medMode ? MYO_SETS(isDeloadWeek) : EMPTY_SETS(isDeloadWeek),
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
  isDeloadWeek?:     boolean;
  displayWeek?:      number;
  suggestBlockAdvance?: boolean;
  blockHistory?:     Array<{ block: number; startedAt: string; endedAt: string | null }>;
}

interface WorkoutLoggerProps {
  onStartPlayer?: (exercises: PlannedExercise[], dayType: string) => void;
}

export default function WorkoutLogger({ onStartPlayer }: WorkoutLoggerProps = {}) {
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
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
  const [showLibrary, setShowLibrary]       = useState(false);
  const [confirmBlock, setConfirmBlock]     = useState(false);

  // Refs for auto-advance focus: key = "exIdx-setIdx-w" | "exIdx-setIdx-r"
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  function setInputRef(key: string) {
    return (el: HTMLInputElement | null) => {
      if (el) inputRefs.current.set(key, el);
      else inputRefs.current.delete(key);
    };
  }
  function focusInput(key: string) {
    const el = inputRefs.current.get(key);
    if (el) { el.focus(); el.select(); }
  }
  function handleWeightKey(exIdx: number, si: number, e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      focusInput(`${exIdx}-${si}-r`);
    }
  }
  function handleRepsKey(exIdx: number, si: number, e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      // Try next set of same exercise, then first set of next exercise
      const nextSetKey = `${exIdx}-${si + 1}-w`;
      const nextExKey  = `${exIdx + 1}-0-w`;
      if (inputRefs.current.has(nextSetKey)) focusInput(nextSetKey);
      else if (inputRefs.current.has(nextExKey)) focusInput(nextExKey);
    }
  }

  // ── AI Weekly Planner state ────────────────────────────────────────────────
  interface AiPlanExercise { name: string; sets: number }
  interface AiPlanDay { day_name: string; category: string; exercises: AiPlanExercise[] }
  interface AiPlan    { split_type: string; days: AiPlanDay[] }

  const [plannerOpen, setPlannerOpen]     = useState(false);
  const [aiPlan, setAiPlan]               = useState<AiPlan | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planError, setPlanError]         = useState<string | null>(null);

  async function generatePlan() {
    setGeneratingPlan(true);
    setPlanError(null);
    try {
      const res  = await fetch('/api/generate-weekly-plan');
      const data = await res.json() as { plan?: AiPlan; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error');
      setAiPlan(data.plan ?? null);
    } catch (err) {
      setPlanError(String(err));
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function loadAiDay(planned: Array<{ name: string; sets: number }>) {
    const items = planned.filter((p) => p.name);
    if (!items.length) return;
    const isDeload = meso?.isDeloadWeek ?? false;
    setLoadingPrev(true);
    // Build initial logs using AI-recommended set counts
    const fresh: ExerciseLog[] = items.map(({ name, sets }) => ({
      name,
      sets: MAKE_SETS(isDeload ? deloadSetCount(sets) : sets),
      lastWeight: null, lastReps: null, lastDate: null,
      targetWeight: null, targetReps: null,
      isWeightIncrease: false, needsDeload: false,
    }));
    setExercises(fresh);
    setPlannerOpen(false);
    try {
      const results = await Promise.all(
        items.map(({ name }) =>
          fetch(`/api/workouts?exercise_name=${encodeURIComponent(name)}`)
            .then((r) => r.json())
            .catch(() => ({ lastWeight: null, lastReps: null, lastDate: null, maxWeight: null, maxReps: null, needs_deload: false })),
        ),
      );
      setExercises((prev) =>
        prev.map((ex, i) => {
          const r = results[i] ?? {};
          const needsDeload = r.needs_deload === true;
          let targetWeight: number | null = null;
          let targetReps:   number | null = null;
          let isWeightIncrease = false;
          const banded = isBandedExercise(ex.name);
          if (needsDeload && r.maxWeight != null) {
            targetWeight = calcDeloadWeight(r.maxWeight, banded);
            targetReps   = 10;
          } else {
            ({ targetWeight, targetReps, isWeightIncrease } = autoRegulate(
              r.maxWeight ?? null,
              r.maxReps ?? null,
              ex.name,
            ));
          }
          // Set 1: weight + reps pre-filled. Sets 2+: weight only (reps left empty to fill as lifted).
          const preFilled = ex.sets.map((s, si) => ({
            ...s,
            weight: targetWeight !== null ? String(targetWeight) : s.weight,
            reps:   si === 0 && targetReps !== null ? String(targetReps) : '',
          }));
          return { ...ex, lastWeight: r.lastWeight ?? null, lastReps: r.lastReps ?? null, lastDate: r.lastDate ?? null, targetWeight, targetReps, isWeightIncrease, needsDeload, sets: preFilled };
        }),
      );
    } finally {
      setLoadingPrev(false);
    }
  }

  const fetchPrevStats = useCallback(async (day: DayConfig, isMed: boolean, forceDeloadWeek = false) => {
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
          const needsDeload = r.needs_deload === true || forceDeloadWeek;
          const banded = isBandedExercise(ex.name);

          let targetWeight: number | null;
          let targetReps:   number | null;
          let isWeightIncrease = false;

          if (needsDeload && r.maxWeight != null) {
            targetWeight     = calcDeloadWeight(r.maxWeight, banded);
            targetReps       = 10;
            isWeightIncrease = false;
          } else {
            // Phase 12: normal auto-regulation (Rule A / Rule B)
            ({ targetWeight, targetReps, isWeightIncrease } = autoRegulate(
              r.maxWeight ?? null,
              r.maxReps   ?? null,
              ex.name,
            ));
          }

          // Pre-fill: set 1 gets full target (weight + reps) as a starting hint.
          // Sets 2+ get only the target weight pre-filled — reps stay empty so
          // the user enters their real performance for each set independently.
          const preFilled = ex.sets.map((s, si) => ({
            ...s,
            weight: targetWeight !== null ? String(targetWeight) : s.weight,
            reps:   si === 0 && targetReps !== null ? String(targetReps) : '',
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
    const isDeload = meso?.isDeloadWeek ?? false;
    const fresh = buildExerciseLogsForBlock(day, medMode, block, isDeload);
    setExercises(fresh);
    fetchPrevStats(day, medMode, isDeload);
  }, [selectedDay, medMode, fetchPrevStats, meso?.currentBlock, meso?.isDeloadWeek]);

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
      setExercises(buildExerciseLogsForBlock(
        day,
        medMode,
        meso?.currentBlock ?? 1,
        meso?.isDeloadWeek ?? false,
      ));
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

  if (showLibrary) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <button
          type="button"
          onClick={() => setShowLibrary(false)}
          className="flex items-center gap-2 text-sm font-semibold text-violet-400 hover:text-violet-300"
        >
          ← Back to workout
        </button>
        <ExerciseManager />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 pb-6">

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
            onClick={() => setConfirmBlock(true)}
            disabled={advancingBlock}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                       text-white font-bold py-3 text-sm transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {advancingBlock
              ? 'Updating…'
              : `✅ Initiate Block ${meso.currentBlock === 1 ? 2 : 1}`}
          </button>
          {confirmBlock && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 pb-6 px-4">
              <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-3xl p-6 flex flex-col gap-4">
                <p className="text-white font-bold text-center">Start Block {meso.currentBlock === 1 ? 2 : 1}?</p>
                <p className="text-xs text-gray-400 text-center">Exercises will swap for the next mesocycle block.</p>
                <button
                  type="button"
                  onClick={() => { setConfirmBlock(false); void handleAdvanceBlock(); }}
                  className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold"
                >
                  Yes, switch block
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBlock(false)}
                  className="w-full py-3 rounded-xl bg-gray-800 text-gray-300 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mesocycle progress indicator (subtle) */}
      {meso?.isDeloadWeek && (
        <div className="rounded-2xl bg-blue-900/30 border border-blue-500/40 px-4 py-3">
          <p className="text-sm font-bold text-blue-200">🔄 Deload week (week {meso.displayWeek ?? 8})</p>
          <p className="text-xs text-blue-300/80 mt-1 leading-relaxed">
            Planned recovery: ~40% fewer sets, ~12% lighter loads. Targets are pre-adjusted below.
          </p>
        </div>
      )}

      {meso?.blockHistory && meso.blockHistory.length > 0 && (
        <details className="rounded-xl bg-gray-800/40 border border-gray-700/50 px-3 py-2">
          <summary className="text-xs text-gray-400 cursor-pointer">Mesocycle history</summary>
          <ul className="mt-2 space-y-1 text-[11px] text-gray-500">
            {meso.blockHistory.map((h) => (
              <li key={`${h.block}-${h.startedAt}`}>
                Block {h.block} · {h.startedAt.slice(0, 10)}
                {h.endedAt ? ` → ${h.endedAt.slice(0, 10)}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      {meso && !meso.mesocycleComplete && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-500">
            Block {meso.currentBlock} · Week {meso.displayWeek ?? meso.weeksElapsed + 1}/{MESOCYCLE_WEEKS}
            {meso.isDeloadWeek ? ' · Deload' : ''}
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
      {(() => {
        // Monday=0 … Sunday=6, matching SPLIT indices
        const todayIdx = (new Date().getDay() + 6) % 7;
        return (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SPLIT.map((_d, i) => {
              const isToday    = i === todayIdx;
              const isSelected = i === selectedDay;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-150
                    ${isSelected
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : isToday
                      ? 'bg-gray-700 border-emerald-500/60 text-emerald-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                >
                  {`Day ${i + 1}`}
                  {isToday && (
                    <span className={`text-[9px] font-bold leading-none mt-0.5 ${isSelected ? 'text-violet-200' : 'text-emerald-400'}`}>
                      today
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── AI Weekly Planner (prominent, near top) ─────────────────────────── */}
      <div className="rounded-2xl border border-violet-500/30 bg-violet-900/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setPlannerOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🤖</span>
            <div>
              <p className="text-sm font-semibold text-white">AI Weekly Routine</p>
              <p className="text-[11px] text-gray-400">Generate a plan from your exercise library</p>
            </div>
          </div>
          <span className="text-gray-500 text-xs">{plannerOpen ? '▲' : '▼'}</span>
        </button>

        {plannerOpen && (
          <div className="border-t border-violet-500/20 p-4 flex flex-col gap-4">
            {!aiPlan && (
              <button
                type="button"
                onClick={generatePlan}
                disabled={generatingPlan}
                className="min-h-[44px] w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                           disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                {generatingPlan ? '⏳ Generating...' : '✨ Generate 5-Day Split'}
              </button>
            )}
            {planError && (
              <div className="rounded-xl px-4 py-3 bg-red-900/30 border border-red-500/30 text-red-300 text-xs">
                ⚠️ {planError}
              </div>
            )}
            {aiPlan && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {aiPlan.split_type ?? '5-day'} split
                  </p>
                  <button
                    type="button"
                    onClick={() => { setAiPlan(null); setPlanError(null); }}
                    className="text-xs text-gray-500 hover:text-gray-300 underline"
                  >
                    Regenerate
                  </button>
                </div>
                {aiPlan.days?.map((d, idx) => {
                  const isRest = !d.exercises?.length || d.category === 'Rest';
                  const catColor: Record<string, string> = {
                    Push: 'border-orange-500/40 bg-orange-500/5',
                    Pull: 'border-blue-500/40 bg-blue-500/5',
                    Legs: 'border-green-500/40 bg-green-500/5',
                    Upper:'border-violet-500/40 bg-violet-500/5',
                    Rest: 'border-gray-700 bg-gray-800/30',
                  };
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 flex flex-col gap-2 ${catColor[d.category] ?? 'border-gray-700 bg-gray-800/30'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-semibold">{d.day_name}</p>
                          <p className="text-gray-400 text-xs">{d.category}</p>
                        </div>
                        {!isRest && onStartPlayer && (
                          <div className="flex flex-col gap-1.5 items-end flex-shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => onStartPlayer(
                                d.exercises.map((e) => ({
                                  name: e.name,
                                  sets: meso?.isDeloadWeek ? deloadSetCount(e.sets) : e.sets,
                                })),
                                d.category,
                              )}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl
                                         bg-green-600 hover:bg-green-500 text-white transition-colors whitespace-nowrap"
                            >
                              ▶ Start Player
                            </button>
                            <button
                              type="button"
                              onClick={() => loadAiDay(d.exercises)}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl
                                         bg-gray-700 hover:bg-gray-600 text-white transition-colors whitespace-nowrap"
                            >
                              Load to Logger
                            </button>
                          </div>
                        )}
                      </div>
                      {isRest ? (
                        <p className="text-gray-500 text-xs italic">Rest & Recovery</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {d.exercises.map((ex) => (
                            <li key={ex.name} className="flex items-center justify-between text-xs text-gray-300">
                              <span className="flex items-start gap-1.5">
                                <span className="text-gray-600 mt-0.5">·</span> {ex.name}
                              </span>
                              <span className="text-gray-600 flex-shrink-0 ml-2">{ex.sets}×</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Day label + Google Fit sync */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-white">{day.label}</h2>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowLibrary(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700
                     text-gray-300 text-xs font-semibold hover:text-white hover:border-gray-600 transition-colors"
        >
          📚 Library
        </button>
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
                    Stagnation over 3 recent sessions. Auto-deload (~12% lighter).
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
                      🔻 Deload
                    </span>
                  )}
                  {/* Phase 12: weight-increase indicator (only when no deload) */}
                  {ex.isWeightIncrease && !ex.needsDeload && !medMode && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                      {isBandedExercise(ex.name) && ex.targetWeight != null
                        ? `⬆️ ${formatBandLevel(ex.targetWeight)}`
                        : `⬆️ +${weightIncrementKg(ex.name)} kg`}
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
                    ? `Previous: ${formatExerciseLoad(ex.lastWeight, ex.name)} × ${ex.lastReps} reps${ex.lastDate ? ` (${ex.lastDate})` : ''}`
                    : 'No previous data'}
                </p>
                {/* Target hint: deload shows amber, normal auto-regulation shows violet */}
                {!loadingPrev && ex.targetWeight !== null && ex.targetReps !== null && !medMode && (
                  <p className={`text-[11px] mt-0.5 font-medium ${ex.needsDeload ? 'text-amber-400' : 'text-violet-400'}`}>
                    {ex.needsDeload ? '🔻' : '🎯'} Target: {formatExerciseLoad(ex.targetWeight, ex.name)} × {ex.targetReps} reps
                  </p>
                )}
              </div>

              {/* Set rows */}
              <div className="flex flex-col gap-2">
                {/* Column headers */}
                <div className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
                  <span className="text-xs text-gray-500 text-center">Set</span>
                  <span className="text-xs text-gray-500 text-center">
                    {isBandedExercise(ex.name) ? 'Band' : 'Weight (kg)'}
                  </span>
                  <span className="text-xs text-gray-500 text-center">Reps</span>
                </div>

                {ex.sets.map((s, si) => {
                  const isMiniSet = s.setLabel.startsWith('M');
                  const isActivation = s.setLabel === 'ACT';
                  const setFilled = s.weight.trim() !== '' && s.reps.trim() !== '';
                  const banded = isBandedExercise(ex.name);
                  return (
                    <div key={si}>
                      {/* 10s rest hint before mini-sets */}
                      {isMiniSet && si === 1 && (
                        <p className="text-[10px] text-amber-400/70 text-center mb-1.5">
                          ⏱ 10 sec rest between mini-sets
                        </p>
                      )}
                      <div className={`grid grid-cols-[40px_1fr_1fr] gap-2 items-center rounded-xl p-1 transition-colors
                        ${setFilled ? 'bg-emerald-900/25 ring-1 ring-emerald-600/40' : ''}`}>
                        <span className={`text-[10px] font-bold text-center leading-none px-0.5
                          ${isActivation ? 'text-amber-400' : isMiniSet ? 'text-violet-400' : 'text-gray-400'}`}>
                          {s.setLabel}
                        </span>
                        {banded ? (
                          <select
                            value={s.weight}
                            onChange={(e) => handleSetChange(exIdx, si, 'weight', e.target.value)}
                            className="min-h-[44px] bg-gray-900 rounded-xl text-white text-sm text-center border border-gray-700 focus:border-violet-500 focus:outline-none w-full"
                          >
                            <option value="">—</option>
                            <option value="1">Light</option>
                            <option value="2">Medium</option>
                            <option value="3">Heavy</option>
                          </select>
                        ) : (
                          <input
                            ref={setInputRef(`${exIdx}-${si}-w`)}
                            type="number"
                            inputMode="decimal"
                            placeholder={isActivation ? 'heavy' : '0'}
                            value={s.weight}
                            onChange={(e) => handleSetChange(exIdx, si, 'weight', e.target.value)}
                            onKeyDown={(e) => handleWeightKey(exIdx, si, e)}
                            className={`min-h-[44px] bg-gray-900 rounded-xl text-white text-sm text-center placeholder-gray-600 focus:outline-none transition-colors w-full
                              ${isActivation
                                ? 'border border-amber-500/50 focus:border-amber-400'
                                : isMiniSet
                                  ? 'border border-violet-700/50 focus:border-violet-500'
                                  : 'border border-gray-700 focus:border-violet-500'
                              }`}
                          />
                        )}
                        <input
                          ref={setInputRef(`${exIdx}-${si}-r`)}
                          type="number"
                          inputMode="numeric"
                          placeholder={
                            isActivation
                              ? 'fail'
                              : ex.targetReps != null
                              ? String(ex.targetReps)
                              : '—'
                          }
                          value={s.reps}
                          onChange={(e) => handleSetChange(exIdx, si, 'reps', e.target.value)}
                          onKeyDown={(e) => handleRepsKey(exIdx, si, e)}
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

          {!day.isRest && (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="w-full min-h-[52px] mt-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                         disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-bold text-sm rounded-2xl
                         shadow-lg shadow-violet-900/40 transition-colors duration-150"
            >
              {isSubmitting ? 'Saving...' : 'Finish Workout'}
            </button>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                        bg-gray-700 text-white text-sm font-medium
                        px-5 py-3 rounded-2xl shadow-xl border border-gray-600
                        animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
