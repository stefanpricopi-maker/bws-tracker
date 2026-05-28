/**
 * WorkoutPlayer — full-screen distraction-free workout guide.
 * Driven by an AI-generated plan. Saves each set to the DB in real time via
 * POST /api/workout-set. Guides through: working → rest timer → next set →
 * next exercise → completion screen.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { autoRegulate as autoRegulateCalc, calcDeloadWeight } from '../lib/fitness';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlannedExercise {
  name: string;
  sets: number; // AI-determined set count
}

interface WorkoutPlayerProps {
  exercises:  PlannedExercise[];
  dayType:    string;
  onComplete: () => void;
  onClose:    () => void;
}

interface ExStats {
  targetWeight:   number | null;
  targetReps:     number | null;
  lastWeight:     number | null;
  lastReps:       number | null;
  needsDeload:    boolean;
  imageUrl:       string | null;
}

type Phase = 'loading' | 'working' | 'resting' | 'complete';

// ── Constants ────────────────────────────────────────────────────────────────

const REST_SECONDS = 60;

// ── Component ────────────────────────────────────────────────────────────────

export default function WorkoutPlayer({ exercises, dayType, onComplete, onClose }: WorkoutPlayerProps) {
  const [phase, setPhase]               = useState<Phase>('loading');
  const [exIdx, setExIdx]               = useState(0);
  const [setIdx, setSetIdx]             = useState(1);   // 1-based current set
  const [stats, setStats]               = useState<Record<string, ExStats>>({});
  const [weight, setWeight]             = useState('');
  const [reps, setReps]                 = useState('');
  const [restSecs, setRestSecs]         = useState(REST_SECONDS);
  const [workoutId, setWorkoutId]       = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [startTime]                     = useState(() => Date.now());
  const [setsLogged, setSetsLogged]     = useState(0);
  const timerRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load stats + image URLs for all exercises ─────────────────────────────

  useEffect(() => {
    async function load() {
      // Fetch image URLs from exercise library
      const libRes   = await fetch('/api/exercises').catch(() => ({ json: async () => ({ exercises: [] }) }));
      const libData  = await libRes.json() as { exercises: Array<{ name: string; imageUrl?: string | null }> };
      const imageMap = Object.fromEntries(
        (libData.exercises ?? []).map((e) => [e.name, e.imageUrl ?? null]),
      );

      // Fetch prev stats for each exercise in parallel
      const results = await Promise.all(
        exercises.map((ex) =>
          fetch(`/api/workouts?exercise_name=${encodeURIComponent(ex.name)}`)
            .then((r) => r.json())
            .catch(() => ({})),
        ),
      );

      const statsMap: Record<string, ExStats> = {};
      exercises.forEach((ex, i) => {
        const r = results[i] ?? {};
        const needsDeload = r.needs_deload === true;
        let targetWeight: number | null = null;
        let targetReps:   number | null = null;
        if (needsDeload && r.maxWeight != null) {
          targetWeight = calcDeloadWeight(r.maxWeight);
          targetReps   = 10;
        } else {
          ({ targetWeight, targetReps } = autoRegulateCalc(r.maxWeight ?? null, r.maxReps ?? null));
        }
        statsMap[ex.name] = {
          targetWeight,
          targetReps,
          lastWeight: r.lastWeight ?? null,
          lastReps:   r.lastReps   ?? null,
          needsDeload,
          imageUrl:   imageMap[ex.name] ?? null,
        };
      });

      setStats(statsMap);
      prefillInputs(exercises[0].name, statsMap);
      setPhase('working');
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prefillInputs(name: string, statsMap: Record<string, ExStats>) {
    const s = statsMap[name];
    setWeight(s?.targetWeight != null ? String(s.targetWeight) : '');
    setReps(  s?.targetReps   != null ? String(s.targetReps)   : '');
  }

  // ── Rest-timer tick ───────────────────────────────────────────────────────

  function startRestTimer(onDone: () => void) {
    setRestSecs(REST_SECONDS);
    setPhase('resting');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRestSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Advance to next set / exercise ────────────────────────────────────────

  const advanceAfterRest = useCallback(() => {
    const ex = exercises[exIdx];
    if (setIdx < ex.sets) {
      const next = setIdx + 1;
      setSetIdx(next);
      prefillInputs(ex.name, stats);
      setPhase('working');
    } else {
      const nextEx = exIdx + 1;
      if (nextEx >= exercises.length) {
        setPhase('complete');
      } else {
        setExIdx(nextEx);
        setSetIdx(1);
        prefillInputs(exercises[nextEx].name, stats);
        setPhase('working');
      }
    }
    setSaveError(null);
  }, [exIdx, setIdx, exercises, stats]);

  // ── Save set to DB ────────────────────────────────────────────────────────

  async function handleSaveSet() {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r) || r < 1) {
      setSaveError('Enter valid weight and reps before saving.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        exercise_name: exercises[exIdx].name,
        weight:        w,
        reps:          r,
        set_number:    setIdx,
        day_type:      dayType,
      };
      if (workoutId) body.workout_id = workoutId;

      const res  = await fetch('/api/workout-set', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { workout_id?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      if (data.workout_id) setWorkoutId(data.workout_id);
      setSetsLogged((n) => n + 1);
    } catch (err) {
      setSaveError(String(err));
      setSaving(false);
      return;
    }
    setSaving(false);

    const ex = exercises[exIdx];
    if (setIdx < ex.sets) {
      // More sets remaining — start rest timer
      startRestTimer(advanceAfterRest);
    } else {
      // Last set of this exercise
      const nextEx = exIdx + 1;
      if (nextEx >= exercises.length) {
        setPhase('complete');
      } else {
        // Brief 30-second rest between exercises
        startRestTimer(advanceAfterRest);
      }
    }
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const ex       = exercises[exIdx];
  const exStats  = ex ? stats[ex.name] : null;
  const elapsed  = Math.round((Date.now() - startTime) / 60000);

  // ── Progress bar ─────────────────────────────────────────────────────────
  const totalSets  = exercises.reduce((s, e) => s + e.sets, 0);
  const progress   = totalSets > 0 ? Math.round((setsLogged / totalSets) * 100) : 0;

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex justify-center bg-black/60">
        <div className="w-full max-w-md bg-gray-950 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
          <p className="text-gray-400 text-sm">Loading exercise data...</p>
        </div>
      </div>
    );
  }

  // ── Render: Complete ──────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="fixed inset-0 z-50 flex justify-center bg-black/60">
      <div className="w-full max-w-md bg-gray-950 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <span className="text-7xl">🏆</span>
        <div>
          <h1 className="text-3xl font-black text-white">Workout Complete!</h1>
          <p className="text-gray-400 mt-2">
            {exercises.length} exercises · {setsLogged} sets · ~{elapsed} min
          </p>
        </div>
        {/* Progress recap */}
        <div className="w-full max-w-xs flex flex-col gap-2">
          {exercises.map((e) => (
            <div key={e.name} className="flex items-center gap-2 text-sm text-gray-300">
              <span className="text-green-400">✓</span>
              <span className="flex-1 text-left">{e.name}</span>
              <span className="text-gray-500">{e.sets} sets</span>
            </div>
          ))}
        </div>
        <button
          onClick={onComplete}
          className="min-h-[56px] w-full max-w-xs bg-violet-600 hover:bg-violet-500
                     text-white font-black text-lg rounded-2xl shadow-lg shadow-violet-900/40
                     transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
      </div>
    );
  }

  // ── Render: Rest timer ────────────────────────────────────────────────────
  if (phase === 'resting') {
    const nextIsNewExercise = setIdx >= (ex?.sets ?? 1);
    const nextName = nextIsNewExercise
      ? (exercises[exIdx + 1]?.name ?? '')
      : ex?.name ?? '';
    const nextSetNum = nextIsNewExercise ? 1 : setIdx + 1;

    // SVG circle progress for timer
    const R = 70;
    const circ = 2 * Math.PI * R;
    const dashOffset = circ * (1 - restSecs / REST_SECONDS);

    return (
      <div className="fixed inset-0 z-50 flex justify-center bg-black/60">
      <div className="w-full max-w-md bg-gray-950 flex flex-col items-center justify-between py-12 px-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-4xl">✅</span>
          <h2 className="text-xl font-bold text-white mt-2">Set Saved!</h2>
          <p className="text-gray-400 text-sm">
            {ex?.name} — Set {setIdx} of {ex?.sets}
          </p>
        </div>

        {/* Circular timer */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Rest</p>
          <div className="relative">
            <svg width="180" height="180" className="-rotate-90">
              <circle cx="90" cy="90" r={R} fill="none" stroke="#1f2937" strokeWidth="10" />
              <circle
                cx="90" cy="90" r={R}
                fill="none"
                stroke={restSecs > 15 ? '#7c3aed' : '#dc2626'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-5xl font-black tabular-nums ${restSecs <= 10 ? 'text-red-400' : 'text-white'}`}>
                {restSecs}
              </span>
              <span className="text-gray-500 text-xs">seconds</span>
            </div>
          </div>

          {/* Next preview */}
          <div className="text-center">
            <p className="text-xs text-gray-500">Up next</p>
            <p className="text-white font-semibold text-sm">{nextName}</p>
            <p className="text-gray-400 text-xs">Set {nextSetNum} of {nextIsNewExercise ? (exercises[exIdx + 1]?.sets ?? 1) : ex?.sets}</p>
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            advanceAfterRest();
          }}
          className="min-h-[56px] w-full max-w-xs bg-gray-800 hover:bg-gray-700
                     border border-gray-600 text-white font-bold text-base rounded-2xl transition-colors"
        >
          Skip Rest →
        </button>
      </div>
      </div>
    );
  }

  // ── Render: Working ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/60">
    <div className="w-full max-w-md bg-gray-950 flex flex-col overflow-hidden">

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 flex-shrink-0">
        <div
          className="h-full bg-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <p className="text-gray-400 text-sm font-medium">
          Exercise <span className="text-white font-bold">{exIdx + 1}</span> / {exercises.length}
        </p>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center
                     text-gray-400 hover:text-white transition-colors text-lg"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 pb-4">

        {/* Form-guide image */}
        {exStats?.imageUrl ? (
          <div className="rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 flex-shrink-0"
               style={{ maxHeight: '220px' }}>
            <img
              src={exStats.imageUrl}
              alt={ex.name}
              className="w-full h-full object-contain"
              style={{ maxHeight: '220px' }}
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0"
               style={{ height: '120px' }}>
            <span className="text-5xl">🏋️</span>
          </div>
        )}

        {/* Exercise name + set counter */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-white leading-tight">{ex.name}</h1>
          <p className="text-violet-400 font-bold text-lg mt-1">
            Set {setIdx} <span className="text-gray-500 font-normal">of</span> {ex.sets}
          </p>
        </div>

        {/* Auto-regulation hint */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-2">
          {exStats?.needsDeload && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-900/40 border border-amber-500/40 px-3 py-2">
              <span className="text-sm">⚠️</span>
              <p className="text-xs text-amber-300 font-semibold">CNS Fatigue — Deload −20%</p>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">
                {exStats?.needsDeload ? '🔻 Deload Target' : '🎯 Target'}
              </p>
              <p className="text-white font-bold text-base">
                {exStats?.targetWeight != null ? `${exStats.targetWeight} kg` : '—'}
              </p>
              <p className="text-gray-400 text-xs">
                × {exStats?.targetReps != null ? `${exStats.targetReps} reps` : '—'}
              </p>
            </div>
            <div className="w-px bg-gray-700" />
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">📊 Previous</p>
              <p className="text-gray-300 font-semibold text-base">
                {exStats?.lastWeight != null ? `${exStats.lastWeight} kg` : '—'}
              </p>
              <p className="text-gray-500 text-xs">
                × {exStats?.lastReps != null ? `${exStats.lastReps} reps` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Weight + Reps inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Weight (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
              className="min-h-[80px] bg-gray-800 border-2 border-gray-600 focus:border-violet-500
                         rounded-2xl text-white text-3xl font-black text-center
                         placeholder-gray-700 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Reps
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="0"
              className="min-h-[80px] bg-gray-800 border-2 border-gray-600 focus:border-violet-500
                         rounded-2xl text-white text-3xl font-black text-center
                         placeholder-gray-700 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Error */}
        {saveError && (
          <div className="rounded-xl bg-red-900/30 border border-red-500/30 px-4 py-3 text-xs text-red-300">
            ⚠️ {saveError}
          </div>
        )}

        {/* Exercise mini-map */}
        <div className="flex gap-1.5 flex-wrap justify-center pb-2">
          {exercises.map((e, i) => (
            <div
              key={e.name}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < exIdx
                  ? 'bg-green-500 w-6'
                  : i === exIdx
                  ? 'bg-violet-500 w-8'
                  : 'bg-gray-700 w-4'
              }`}
            />
          ))}
        </div>
      </div>

      {/* SAVE SET + Quit — sticky bottom */}
      <div className="flex-shrink-0 px-4 pb-6 pt-2 bg-gray-950 border-t border-gray-800 flex flex-col gap-2">
        <button
          onClick={handleSaveSet}
          disabled={saving}
          className="w-full min-h-[64px] bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                     disabled:opacity-60 disabled:cursor-not-allowed
                     text-white font-black text-xl tracking-wide rounded-2xl
                     shadow-2xl shadow-violet-900/60
                     transition-colors duration-150"
        >
          {saving ? '⏳ Saving...' : 'SAVE SET ▶'}
        </button>
        <button
          onClick={onClose}
          className="w-full min-h-[44px] bg-transparent border border-gray-700 hover:border-red-500/60
                     hover:text-red-400 text-gray-500 font-semibold text-sm rounded-2xl transition-colors"
        >
          Quit Workout
        </button>
      </div>
    </div>
    </div>
  );
}
