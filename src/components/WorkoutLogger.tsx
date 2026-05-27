import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface SetInput {
  weight: string;
  reps: string;
}

interface ExerciseLog {
  name: string;
  sets: SetInput[];
  lastWeight: number | null;
  lastReps: number | null;
  lastDate: string | null;
}

interface DayConfig {
  label: string;
  dayType: string;
  exercises: string[];
  isRest: boolean;
}

// ── 7-Day Hybrid Split ─────────────────────────────────────────────────────

const SPLIT: DayConfig[] = [
  {
    label: 'Day 1 — Push',
    dayType: 'Push',
    exercises: [
      'Bench Press',
      'Overhead Press',
      'Incline Dumbbell Press',
      'Lateral Raises',
      'Tricep Pushdowns',
      'Overhead Tricep Extensions',
    ],
    isRest: false,
  },
  {
    label: 'Day 2 — Pull',
    dayType: 'Pull',
    exercises: [
      'Barbell Row',
      'Pull-Ups',
      'Seated Cable Row',
      'Face Pulls',
      'Barbell Curl',
      'Hammer Curl',
    ],
    isRest: false,
  },
  {
    label: 'Day 3 — Legs',
    dayType: 'Legs',
    exercises: [
      'Barbell Squat',
      'Romanian Deadlift',
      'Leg Press',
      'Leg Curl',
      'Calf Raises',
    ],
    isRest: false,
  },
  {
    label: 'Day 4 — Rest',
    dayType: 'Rest',
    exercises: [],
    isRest: true,
  },
  {
    label: 'Day 5 — Upper',
    dayType: 'Upper',
    exercises: [
      'Incline Bench Press',
      'Incline Dumbbell Curl',
      'Cable Fly',
      'Tricep Dips',
      'Concentration Curl',
    ],
    isRest: false,
  },
  {
    label: 'Day 6 — Legs + Arms',
    dayType: 'Legs+Arms',
    exercises: [
      'Front Squat',
      'Crossbody Hammer Curl',
      'Leg Extension',
      'Preacher Curl',
      'Seated Calf Raise',
    ],
    isRest: false,
  },
  {
    label: 'Day 7 — Rest',
    dayType: 'Rest',
    exercises: [],
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
  { weight: '', reps: '' },
  { weight: '', reps: '' },
  { weight: '', reps: '' },
];

function buildExerciseLogs(day: DayConfig): ExerciseLog[] {
  return day.exercises.map((name) => ({
    name,
    sets: EMPTY_SETS(),
    lastWeight: null,
    lastReps: null,
    lastDate: null,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WorkoutLogger() {
  const [selectedDay, setSelectedDay] = useState(0); // 0-indexed
  const [exercises, setExercises] = useState<ExerciseLog[]>(() =>
    buildExerciseLogs(SPLIT[0]),
  );
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchPrevStats = useCallback(async (day: DayConfig) => {
    if (day.isRest) return;
    setLoadingPrev(true);
    try {
      const results = await Promise.all(
        day.exercises.map((name) =>
          fetch(`/api/workouts?exercise_name=${encodeURIComponent(name)}`)
            .then((r) => r.json())
            .catch(() => ({ lastWeight: null, lastReps: null, lastDate: null })),
        ),
      );
      setExercises((prev) =>
        prev.map((ex, i) => ({
          ...ex,
          lastWeight: results[i]?.lastWeight ?? null,
          lastReps: results[i]?.lastReps ?? null,
          lastDate: results[i]?.lastDate ?? null,
        })),
      );
    } finally {
      setLoadingPrev(false);
    }
  }, []);

  // When day changes, reset exercise logs and fetch previous stats
  useEffect(() => {
    const day = SPLIT[selectedDay];
    const fresh = buildExerciseLogs(day);
    setExercises(fresh);
    fetchPrevStats(day);
  }, [selectedDay, fetchPrevStats]);

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
        body: JSON.stringify({ date: today, dayType: day.dayType, sets }),
      });
      if (!res.ok) throw new Error('Server error');
      showToast('Workout saved!');
      setExercises(buildExerciseLogs(day));
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

  const day = SPLIT[selectedDay];

  return (
    <div className="relative flex flex-col gap-4 pb-28">
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

      {/* Day label */}
      <h2 className="text-base font-bold text-white">{day.label}</h2>

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
              {/* Exercise header */}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-sm">{ex.name}</h3>
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
              </div>

              {/* Set rows */}
              <div className="flex flex-col gap-2">
                {/* Column headers */}
                <div className="grid grid-cols-[32px_1fr_1fr] gap-2 items-center">
                  <span className="text-xs text-gray-500 text-center">Set</span>
                  <span className="text-xs text-gray-500 text-center">Weight (kg)</span>
                  <span className="text-xs text-gray-500 text-center">Reps</span>
                </div>

                {ex.sets.map((s, si) => (
                  <div key={si} className="grid grid-cols-[32px_1fr_1fr] gap-2 items-center">
                    <span className="text-xs font-medium text-gray-400 text-center">{si + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={s.weight}
                      onChange={(e) => handleSetChange(exIdx, si, 'weight', e.target.value)}
                      className="min-h-[44px] bg-gray-900 border border-gray-700 rounded-xl text-white text-sm text-center placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors w-full"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={s.reps}
                      onChange={(e) => handleSetChange(exIdx, si, 'reps', e.target.value)}
                      className="min-h-[44px] bg-gray-900 border border-gray-700 rounded-xl text-white text-sm text-center placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors w-full"
                    />
                  </div>
                ))}
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
