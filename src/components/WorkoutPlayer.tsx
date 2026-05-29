/**
 * WorkoutPlayer — full-screen distraction-free workout guide.
 * Driven by an AI-generated plan. Saves each set to the DB in real time via
 * POST /api/workout-set. Guides through: working → rest timer → next set →
 * next exercise → completion screen.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { autoRegulate as autoRegulateCalc, calcDeloadWeight } from '../lib/fitness';
import { restSecondsForExercise } from '../lib/restDuration';
import { isBandedExercise, formatExerciseLoad } from '../lib/exerciseKind';
import { isHighRiskMedExercise, needsWarmupSet, suggestedWarmupWeight } from '../lib/workoutSafety';

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

function notifyRestComplete() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([120, 60, 120]);
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* audio optional */
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WorkoutPlayer({ exercises, dayType, onComplete, onClose }: WorkoutPlayerProps) {
  const [phase, setPhase]               = useState<Phase>('loading');
  const [exIdx, setExIdx]               = useState(0);
  const [setIdx, setSetIdx]             = useState(1);   // 1-based current set
  const [stats, setStats]               = useState<Record<string, ExStats>>({});
  const [weight, setWeight]             = useState('');
  const [reps, setReps]                 = useState('');
  const [restSecs, setRestSecs]         = useState(90);
  const [restTotal, setRestTotal]       = useState(90);
  const [showPlan, setShowPlan]         = useState(false);
  const [workoutId, setWorkoutId]       = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [startTime]                     = useState(() => Date.now());
  const [setsLogged, setSetsLogged]     = useState(0);
  const [confirmQuit, setConfirmQuit]   = useState(false);
  const [supersetMode, setSupersetMode] = useState(false);
  const [rpe, setRpe]                   = useState('');
  const [warmupDone, setWarmupDone]     = useState<Record<number, boolean>>({});
  const timerRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  function prefillInputs(name: string, statsMap: Record<string, ExStats>) {
    const s = statsMap[name];
    setWeight(s?.targetWeight != null ? String(s.targetWeight) : '');
    setReps(  s?.targetReps   != null ? String(s.targetReps)   : '');
  }

  const loadSession = useCallback(async () => {
    setPhase('loading');
    const libRes  = await fetch('/api/exercises').catch(() => ({ json: async () => ({ exercises: [] }) }));
    const libData = await libRes.json() as { exercises: Array<{ name: string; imageUrl?: string | null }> };
    const imageMap = Object.fromEntries(
      (libData.exercises ?? []).map((e) => [e.name, e.imageUrl ?? null]),
    );

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
        targetWeight = calcDeloadWeight(r.maxWeight, isBandedExercise(ex.name));
        targetReps   = 10;
      } else {
        ({ targetWeight, targetReps } = autoRegulateCalc(
          r.maxWeight ?? null,
          r.maxReps ?? null,
          ex.name,
        ));
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
    setWarmupDone({});
    setExIdx(0);
    setSetIdx(1);
    prefillInputs(exercises[0].name, statsMap);
    setPhase('working');
  }, [exercises]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // ── Rest-timer tick ───────────────────────────────────────────────────────

  function startRestTimer(seconds: number, onDone: () => void) {
    const dur = Math.max(30, seconds);
    setRestTotal(dur);
    setRestSecs(dur);
    setPhase('resting');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRestSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          notifyRestComplete();
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

  async function abandonSession() {
    if (workoutId == null) return;
    try {
      await fetch(`/api/workout-set?workout_id=${workoutId}`, { method: 'DELETE' });
    } catch {
      /* best effort — partial session must not affect history */
    }
    setWorkoutId(null);
  }

  async function handleQuitConfirmed() {
    setConfirmQuit(false);
    if (phase !== 'complete') await abandonSession();
    onClose();
  }

  const skipExercise = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const nextEx = exIdx + 1;
    if (nextEx >= exercises.length) {
      setPhase('complete');
    } else {
      setExIdx(nextEx);
      setSetIdx(1);
      prefillInputs(exercises[nextEx].name, stats);
      setPhase('working');
    }
    setSaveError(null);
  }, [exIdx, exercises, stats]);

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
      const rpeNum = parseFloat(rpe);
      if (!isNaN(rpeNum) && rpeNum >= 1 && rpeNum <= 10) body.rpe = rpeNum;

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

    setRpe('');
    const ex = exercises[exIdx];
    const baseRest = restSecondsForExercise(ex.name);
    const rest = supersetMode && exIdx % 2 === 0 ? Math.min(45, baseRest) : baseRest;
    if (setIdx < ex.sets) {
      startRestTimer(rest, advanceAfterRest);
    } else {
      const nextEx = exIdx + 1;
      if (nextEx >= exercises.length) {
        setPhase('complete');
      } else {
        const nextRest = supersetMode && exIdx % 2 === 0
          ? Math.min(45, restSecondsForExercise(exercises[nextEx].name))
          : restSecondsForExercise(exercises[nextEx].name);
        startRestTimer(nextRest, advanceAfterRest);
      }
    }
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const ex       = exercises[exIdx];
  const exStats  = ex ? stats[ex.name] : null;
  const showWarmup =
    phase === 'working' &&
    setIdx === 1 &&
    !warmupDone[exIdx] &&
    !!ex &&
    needsWarmupSet(ex.name);
  const warmupKg = ex
    ? suggestedWarmupWeight(exStats?.targetWeight ?? 0, isBandedExercise(ex.name))
    : null;
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
          <p className="text-gray-400 text-sm" data-testid="player-loading">Loading exercise data...</p>
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
    const dashOffset = circ * (1 - restSecs / Math.max(restTotal, 1));

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

        {/* Skip + Quit buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            data-testid="skip-rest"
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              advanceAfterRest();
            }}
            className="min-h-[56px] w-full bg-gray-800 hover:bg-gray-700
                       border border-gray-600 text-white font-bold text-base rounded-2xl transition-colors"
          >
            Skip Rest →
          </button>
          <button
            onClick={() => setConfirmQuit(true)}
            className="min-h-[44px] w-full bg-transparent text-gray-600 hover:text-red-400 text-sm font-medium transition-colors"
          >
            Quit Workout
          </button>
        </div>

        {/* Quit confirm */}
        {confirmQuit && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 pb-6 px-4">
            <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl">
              <div className="text-center">
                <p className="text-2xl mb-2">🚪</p>
                <p className="text-white font-bold text-lg">Quit workout?</p>
                <p className="text-gray-400 text-sm mt-1">
                  {setsLogged > 0
                    ? `${setsLogged} partial set${setsLogged !== 1 ? 's' : ''} will be discarded so they do not affect your history.`
                    : 'No sets saved yet.'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => void handleQuitConfirmed()} className="min-h-[52px] w-full bg-red-600 hover:bg-red-500 text-white font-bold text-base rounded-2xl transition-colors">Yes, quit</button>
                <button onClick={() => setConfirmQuit(false)} className="min-h-[52px] w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold text-base rounded-2xl transition-colors">Continue workout</button>
              </div>
            </div>
          </div>
        )}
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
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setShowPlan((v) => !v)}
          className="text-xs font-semibold text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg bg-violet-900/30"
        >
          {showPlan ? 'Hide plan' : 'Day plan'}
        </button>
        <p className="text-gray-400 text-sm font-medium flex-1 text-center">
          <span className="text-white font-bold">{exIdx + 1}</span> / {exercises.length}
        </p>
        <button
          type="button"
          onClick={() => setConfirmQuit(true)}
          className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center
                     text-gray-400 hover:text-white transition-colors text-lg"
        >
          ✕
        </button>
      </div>

      {showPlan && (
        <div className="mx-4 mb-2 rounded-xl bg-gray-900 border border-gray-700 p-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {exercises.map((e, i) => (
            <div
              key={e.name}
              className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg
                ${i < exIdx ? 'text-emerald-400 bg-emerald-900/20' : i === exIdx ? 'text-violet-300 bg-violet-900/30 font-semibold' : 'text-gray-500'}`}
            >
              <span className="truncate pr-2">{i < exIdx ? '✓ ' : i === exIdx ? '▶ ' : ''}{e.name}</span>
              <span className="shrink-0 text-gray-600">{e.sets} sets</span>
            </div>
          ))}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 pb-36 scroll-pb-safe">

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
          <div className="rounded-2xl bg-gray-900 border border-gray-700 flex flex-col items-center justify-center flex-shrink-0 px-4 py-6 gap-1"
               style={{ minHeight: '120px' }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Form guide</span>
            <p className="text-center text-sm font-semibold text-gray-300 leading-snug">{ex.name}</p>
            <p className="text-[11px] text-gray-600">Add a GIF link in Exercise Library</p>
          </div>
        )}

        {/* Exercise name + set counter */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-white leading-tight">{ex.name}</h1>
          <p className="text-violet-400 font-bold text-lg mt-1">
            {showWarmup ? (
              <span className="text-sky-400">Warmup</span>
            ) : (
              <>
                Set {setIdx} <span className="text-gray-500 font-normal">of</span> {ex.sets}
              </>
            )}
          </p>
        </div>

        {isHighRiskMedExercise(ex.name) && (
          <div className="rounded-xl bg-amber-900/30 border border-amber-500/30 px-3 py-2 text-xs text-amber-200">
            M.E.D. focus: prioritize form and controlled tempo on this lift.
          </div>
        )}

        {showWarmup && (
          <div className="rounded-2xl bg-sky-900/25 border border-sky-500/40 p-4 flex flex-col gap-3">
            <p className="text-sm font-bold text-sky-200">Warmup before working sets</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              {warmupKg != null
                ? `Suggested: ~${warmupKg} kg (≈50% target) for 8–12 easy reps, or empty bar.`
                : 'Do 1–2 light sets to prepare joints before loading working weight.'}
            </p>
          </div>
        )}

        {!showWarmup && (
        <>
        {/* Auto-regulation hint */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-2">
          {exStats?.needsDeload && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-900/40 border border-amber-500/40 px-3 py-2">
              <span className="text-sm">⚠️</span>
              <p className="text-xs text-amber-300 font-semibold">CNS Fatigue — Deload (~12% lighter)</p>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">
                {exStats?.needsDeload ? '🔻 Deload Target' : '🎯 Target'}
              </p>
              <p className="text-white font-bold text-base">
                {exStats?.targetWeight != null
                  ? formatExerciseLoad(exStats.targetWeight, ex.name)
                  : '—'}
              </p>
              <p className="text-gray-400 text-xs">
                × {exStats?.targetReps != null ? `${exStats.targetReps} reps` : '—'}
              </p>
            </div>
            <div className="w-px bg-gray-700" />
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">📊 Previous</p>
              <p className="text-gray-300 font-semibold text-base">
                {exStats?.lastWeight != null
                  ? formatExerciseLoad(exStats.lastWeight, ex.name)
                  : '—'}
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
              {isBandedExercise(ex.name) ? 'Band level' : 'Weight (kg)'}
            </label>
            {isBandedExercise(ex.name) ? (
              <select
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="min-h-[80px] bg-gray-800 border-2 border-gray-600 focus:border-violet-500
                           rounded-2xl text-white text-xl font-bold text-center focus:outline-none"
              >
                <option value="">—</option>
                <option value="1">Light</option>
                <option value="2">Medium</option>
                <option value="3">Heavy</option>
              </select>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onFocus={(e) => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                placeholder="0"
                className="min-h-[80px] bg-gray-800 border-2 border-gray-600 focus:border-violet-500
                           rounded-2xl text-white text-3xl font-black text-center
                           placeholder-gray-700 focus:outline-none transition-colors"
              />
            )}
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
              onFocus={(e) => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })}
              placeholder="0"
              className="min-h-[80px] bg-gray-800 border-2 border-gray-600 focus:border-violet-500
                         rounded-2xl text-white text-3xl font-black text-center
                         placeholder-gray-700 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={supersetMode}
              onChange={(e) => setSupersetMode(e.target.checked)}
              className="rounded"
            />
            Superset pairs (shorter rest)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">RPE</span>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              placeholder="—"
              className="w-14 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm text-center py-1"
            />
          </div>
        </div>
        </>
        )}

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

      {/* SAVE SET + Skip + Quit — sticky bottom */}
      <div className="flex-shrink-0 px-4 pb-6 pt-2 bg-gray-950 border-t border-gray-800 flex flex-col gap-2"
           style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        {showWarmup ? (
          <>
            <button
              type="button"
              data-testid="warmup-done"
              onClick={() => setWarmupDone((d) => ({ ...d, [exIdx]: true }))}
              className="w-full min-h-[64px] bg-sky-600 hover:bg-sky-500 text-white font-black text-xl tracking-wide rounded-2xl transition-colors"
            >
              Warmup done → Set 1
            </button>
            <button
              type="button"
              onClick={() => setWarmupDone((d) => ({ ...d, [exIdx]: true }))}
              className="w-full min-h-[44px] text-gray-500 hover:text-gray-300 text-sm"
            >
              Skip warmup
            </button>
          </>
        ) : (
          <>
        <p className="text-[10px] text-center text-gray-600">
          Rest after save: {restSecondsForExercise(ex.name)}s
          {setIdx >= ex.sets && exIdx + 1 < exercises.length && (
            <> → next: {restSecondsForExercise(exercises[exIdx + 1].name)}s</>
          )}
        </p>
        <button
          type="button"
          data-testid="save-set"
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
          </>
        )}
        <button
          type="button"
          onClick={skipExercise}
          className="w-full min-h-[44px] bg-gray-800 hover:bg-gray-700 border border-gray-600
                     text-gray-300 font-semibold text-sm rounded-2xl transition-colors"
        >
          Skip exercise →
        </button>
        <button
          onClick={() => setConfirmQuit(true)}
          className="w-full min-h-[44px] bg-transparent border border-gray-700 hover:border-red-500/60
                     hover:text-red-400 text-gray-500 font-semibold text-sm rounded-2xl transition-colors"
        >
          Quit Workout
        </button>

        {/* Quit confirmation overlay */}
        {confirmQuit && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 pb-6 px-4">
            <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl">
              <div className="text-center">
                <p className="text-2xl mb-2">🚪</p>
                <p className="text-white font-bold text-lg">Quit workout?</p>
                <p className="text-gray-400 text-sm mt-1">
                  {setsLogged > 0
                    ? `${setsLogged} partial set${setsLogged !== 1 ? 's' : ''} will be discarded so they do not affect your history.`
                    : 'No sets have been saved yet.'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleQuitConfirmed()}
                  className="min-h-[52px] w-full bg-red-600 hover:bg-red-500 text-white font-bold text-base rounded-2xl transition-colors"
                >
                  Yes, quit
                </button>
                <button
                  onClick={() => setConfirmQuit(false)}
                  className="min-h-[52px] w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold text-base rounded-2xl transition-colors"
                >
                  Continue workout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
