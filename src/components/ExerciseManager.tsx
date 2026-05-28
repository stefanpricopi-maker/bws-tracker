import { useState, useEffect } from 'react';

interface Exercise {
  id: number;
  name: string;
  targetMuscle: string;
  category: string;
  isCustom: boolean;
}

const CATEGORIES = ['Push', 'Pull', 'Legs', 'Upper', 'Full Body'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Push:       'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Pull:       'bg-blue-500/15   text-blue-300   border-blue-500/30',
  Legs:       'bg-green-500/15  text-green-300  border-green-500/30',
  Upper:      'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'Full Body':'bg-pink-500/15   text-pink-300   border-pink-500/30',
};

export default function ExerciseManager() {
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterCat, setFilterCat]       = useState<string>('All');
  const [formOpen, setFormOpen]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);

  // Form state
  const [name, setName]               = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [category, setCategory]       = useState<string>(CATEGORIES[0]);

  async function fetchExercises() {
    setLoading(true);
    try {
      const res  = await fetch('/api/exercises');
      const data = await res.json() as { exercises: Exercise[] };
      setAllExercises(data.exercises ?? []);
    } catch {
      setAllExercises([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchExercises(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/exercises', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), target_muscle: targetMuscle.trim(), category }),
      });
      const data = await res.json() as { exercise?: Exercise; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to add exercise.');
      } else {
        setSuccess(`"${data.exercise!.name}" added successfully.`);
        setName(''); setTargetMuscle(''); setCategory(CATEGORIES[0]);
        setFormOpen(false);
        await fetchExercises();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const categories   = ['All', ...CATEGORIES];
  const visible      = filterCat === 'All'
    ? allExercises
    : allExercises.filter((e) => e.category === filterCat);

  const grouped = CATEGORIES.reduce<Record<string, Exercise[]>>((acc, cat) => {
    const items = visible.filter((e) => e.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">Exercise Library</h2>
          <p className="text-gray-400 text-xs mt-0.5">{allExercises.length} exercises · Home-Gym (Dumbbells & Bands)</p>
        </div>
        <button
          onClick={() => { setFormOpen((o) => !o); setError(null); }}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl
                     bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-colors"
        >
          {formOpen ? '✕ Cancel' : '+ Add Exercise'}
        </button>
      </div>

      {/* Success toast */}
      {success && (
        <div className="rounded-xl px-4 py-3 bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 text-sm">
          ✅ {success}
        </div>
      )}

      {/* Add form */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl bg-gray-800 border border-gray-700 p-4"
        >
          <p className="text-white font-semibold text-sm">New Custom Exercise</p>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Exercise Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dumbbell Concentration Curl"
              className="min-h-[44px] bg-gray-900 border border-gray-700 rounded-xl px-3
                         text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Target Muscle</label>
            <input
              required
              value={targetMuscle}
              onChange={(e) => setTargetMuscle(e.target.value)}
              placeholder="e.g. Biceps"
              className="min-h-[44px] bg-gray-900 border border-gray-700 rounded-xl px-3
                         text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-[44px] bg-gray-900 border border-gray-700 rounded-xl px-3
                         text-white text-sm focus:outline-none focus:border-violet-500"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                       disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors"
          >
            {submitting ? 'Adding...' : 'Add to Library'}
          </button>
        </form>
      )}

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors
              ${filterCat === cat
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading library...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{cat}</p>
              <div className="flex flex-col gap-2">
                {items.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between rounded-xl bg-gray-800 border border-gray-700 px-4 py-3"
                  >
                    <div>
                      <p className="text-white text-sm font-medium leading-tight">{ex.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{ex.targetMuscle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ex.isCustom && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                          Custom
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat] ?? ''}`}>
                        {cat}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-gray-500 text-sm py-10">No exercises for this filter.</p>
          )}
        </div>
      )}
    </div>
  );
}
