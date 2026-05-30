import { useState, useEffect, useCallback } from 'react';

interface Exercise {
  id: number;
  name: string;
  targetMuscle: string;
  category: string;
  isCustom: boolean;
}

const CATEGORIES = ['Push', 'Pull', 'Legs', 'Abs', 'Upper', 'Full Body'] as const;
const PAGE_SIZE = 15;

const CATEGORY_COLORS: Record<string, string> = {
  Push:       'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Pull:       'bg-blue-500/15   text-blue-300   border-blue-500/30',
  Legs:       'bg-green-500/15  text-green-300  border-green-500/30',
  Abs:        'bg-amber-500/15  text-amber-300  border-amber-500/30',
  Upper:      'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'Full Body':'bg-pink-500/15   text-pink-300   border-pink-500/30',
};

export default function ExerciseManager() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [filterCat, setFilterCat] = useState<string>('All');
  const [formOpen, setFormOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  const [name, setName]               = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [category, setCategory]       = useState<string>(CATEGORIES[0]);
  const [imageUrl, setImageUrl]       = useState('');

  const fetchPage = useCallback(async (pageIndex: number, categoryFilter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(pageIndex * PAGE_SIZE),
      });
      if (categoryFilter !== 'All') {
        params.set('category', categoryFilter);
      }
      const res  = await fetch(`/api/exercises?${params}`);
      const data = await res.json() as {
        exercises?: Exercise[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        setExercises([]);
        setTotal(0);
        setError(data.error ?? 'Failed to load exercises.');
        return;
      }
      setExercises(data.exercises ?? []);
      setTotal(data.total ?? 0);
      setPage(pageIndex);
      setError(null);
    } catch {
      setExercises([]);
      setTotal(0);
      setError('Network error loading library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(0, filterCat);
  }, [filterCat, fetchPage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/exercises', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), target_muscle: targetMuscle.trim(), category, image_url: imageUrl.trim() || undefined }),
      });
      const data = await res.json() as { exercise?: Exercise; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to add exercise.');
      } else {
        setSuccess(`"${data.exercise!.name}" added successfully.`);
        setName(''); setTargetMuscle(''); setCategory(CATEGORIES[0]); setImageUrl('');
        setFormOpen(false);
        const refreshCat = filterCat === 'All' ? filterCat : data.exercise!.category;
        if (filterCat !== 'All' && filterCat !== data.exercise!.category) {
          setFilterCat(data.exercise!.category);
        } else {
          await fetchPage(0, refreshCat);
        }
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd   = Math.min((page + 1) * PAGE_SIZE, total);
  const hasPrev   = page > 0;
  const hasNext   = (page + 1) * PAGE_SIZE < total;

  const grouped = CATEGORIES.reduce<Record<string, Exercise[]>>((acc, cat) => {
    const items = exercises.filter((e) => e.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const categories = ['All', ...CATEGORIES];

  return (
    <div className="flex flex-col gap-4 pb-8">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">Exercise Library</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            {total} exercise{total !== 1 ? 's' : ''} · Home-Gym (Dumbbells &amp; Bands)
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setFormOpen((o) => !o); setError(null); }}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl
                     bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-colors"
        >
          {formOpen ? '✕ Cancel' : '+ Add Exercise'}
        </button>
      </div>

      {success && (
        <div className="rounded-xl px-4 py-3 bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 text-sm">
          ✅ {success}
        </div>
      )}

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

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Form Guide Image / GIF URL <span className="text-gray-600">(optional)</span></label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/exercise.gif"
              className="min-h-[44px] bg-gray-900 border border-gray-700 rounded-xl px-3
                         text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
            {imageUrl && (
              <img
                src={imageUrl}
                alt="preview"
                className="mt-1 w-full max-h-32 object-contain rounded-xl bg-gray-900 border border-gray-700"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
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

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
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

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading library...</div>
      ) : (
        <>
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
            {exercises.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-10">No exercises for this filter.</p>
            )}
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-800">
              <button
                type="button"
                disabled={!hasPrev || loading}
                onClick={() => void fetchPage(page - 1, filterCat)}
                className="min-h-[40px] px-4 rounded-xl text-sm font-semibold border border-gray-700
                           text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                ← Previous
              </button>
              <p className="text-xs text-gray-500 text-center shrink-0">
                {pageStart}–{pageEnd} of {total}
              </p>
              <button
                type="button"
                disabled={!hasNext || loading}
                onClick={() => void fetchPage(page + 1, filterCat)}
                className="min-h-[40px] px-4 rounded-xl text-sm font-semibold border border-gray-700
                           text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
