import { useState, useEffect, useRef } from 'react';

interface PhotoLog {
  date: string;
  weightKg: number | null;
  photoUrl: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ro-RO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function PhotoVault() {
  const [photos, setPhotos]         = useState<PhotoLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchPhotos(); }, []);

  async function fetchPhotos() {
    setLoading(true);
    try {
      const res = await fetch('/api/logs?limit=365');
      if (!res.ok) return;
      const data = await res.json() as Array<{ date: string; weight_kg: number | null; photo_url?: string }>;
      const withPhotos = data
        .filter(d => d.photo_url)
        .map(d => ({ date: d.date, weightKg: d.weight_kg, photoUrl: d.photo_url! }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setPhotos(withPhotos);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('date', today());

      const res = await fetch('/api/upload-photo', { method: 'POST', body: form });
      let data: { url?: string; error?: string } = {};
      try { data = await res.json(); } catch { throw new Error('Invalid server response'); }

      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      setUploadSuccess(true);
      await fetchPhotos();
      // reset input
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const oldest = photos[0] ?? null;
  const newest = photos[photos.length - 1] ?? null;
  const hasBoth = oldest && newest && oldest.date !== newest.date;

  const weightDiff = hasBoth && oldest.weightKg != null && newest.weightKg != null
    ? +(newest.weightKg - oldest.weightKg).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-6 pb-28">

      {/* ── Upload today's photo ─────────────────────────────── */}
      <div className="rounded-2xl bg-gray-800/60 border border-gray-700 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Today's Progress Photo
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl
                     border-2 border-dashed border-violet-500/40 bg-violet-600/10
                     py-8 text-violet-300 transition-colors
                     hover:bg-violet-600/20 active:bg-violet-600/30
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                        strokeDasharray="31.4" strokeDashoffset="10"/>
              </svg>
              <span className="text-sm font-medium">Uploading…</span>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="text-sm font-medium">Tap to add today's photo</span>
              <span className="text-xs text-gray-500">Front or side pose · max 10 MB</span>
            </>
          )}
        </button>

        {uploadSuccess && (
          <p className="mt-2 text-center text-sm text-emerald-400">✅ Photo saved!</p>
        )}
        {uploadError && (
          <p className="mt-2 text-center text-sm text-red-400">❌ {uploadError}</p>
        )}
      </div>

      {/* ── Before / After comparison ────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Before &amp; After
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
            Loading…
          </div>
        ) : !hasBoth ? (
          <div className="rounded-2xl bg-gray-800/40 border border-gray-700 py-12 text-center">
            <p className="text-3xl mb-2">📸</p>
            <p className="text-sm text-gray-400">
              Upload at least <span className="text-white font-semibold">2 photos</span> on
              different days to see your Before &amp; After comparison.
            </p>
            {photos.length === 1 && (
              <p className="mt-1 text-xs text-gray-500">
                1 photo saved — come back tomorrow!
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* Weight difference badge */}
            {weightDiff !== null && (
              <div className="flex justify-center">
                <span className={`rounded-full px-4 py-1.5 text-sm font-bold border
                  ${weightDiff < 0
                    ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300'
                    : weightDiff > 0
                    ? 'bg-red-900/60 border-red-500 text-red-300'
                    : 'bg-gray-800 border-gray-600 text-gray-300'}`}>
                  {weightDiff < 0 ? '⬇️' : weightDiff > 0 ? '⬆️' : '➡️'}{' '}
                  {Math.abs(weightDiff)} kg
                  {weightDiff < 0 ? ' lost' : weightDiff > 0 ? ' gained' : ' unchanged'}
                </span>
              </div>
            )}

            {/* Side-by-side photos */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Before', log: oldest },
                { label: 'After',  log: newest },
              ].map(({ label, log }) => (
                <div key={label} className="flex flex-col gap-2">
                  <span className={`text-center text-xs font-bold uppercase tracking-widest
                    ${label === 'Before' ? 'text-gray-400' : 'text-violet-400'}`}>
                    {label}
                  </span>
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                    <img
                      src={log.photoUrl}
                      alt={`${label} — ${log.date}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{formatDate(log.date)}</p>
                    {log.weightKg != null && (
                      <p className="text-sm font-semibold text-white">{log.weightKg} kg</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Photo count */}
            {photos.length > 2 && (
              <p className="text-center text-xs text-gray-500">
                {photos.length} total photos · showing oldest vs newest
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── All photos timeline ──────────────────────────────── */}
      {photos.length > 2 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            All Photos
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[...photos].reverse().map(p => (
              <div key={p.date} className="flex flex-col gap-1">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                  <img src={p.photoUrl} alt={p.date} className="w-full h-full object-cover"/>
                </div>
                <p className="text-center text-xs text-gray-500 truncate">{p.date.slice(5)}</p>
                {p.weightKg != null && (
                  <p className="text-center text-xs font-medium text-gray-300">{p.weightKg}kg</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
