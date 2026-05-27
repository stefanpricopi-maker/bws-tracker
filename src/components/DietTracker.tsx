import { useState, useEffect, useRef, useCallback } from 'react';

// ── Targets ────────────────────────────────────────────────────────────────
const TARGETS = {
  calories: 1850,
  protein:  180,
  fat:       75,
  carbs:    113,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

function pct(consumed: number, target: number) {
  return clamp(Math.round((consumed / target) * 100));
}

const today = () => new Date().toISOString().slice(0, 10);

// ── Sub-components ─────────────────────────────────────────────────────────

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string; // Tailwind bg class
}

function MacroBar({ label, consumed, target, unit, color }: MacroBarProps) {
  const remaining = Math.max(0, target - consumed);
  const progress  = pct(consumed, target);
  const over      = consumed > target;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {label}
        </span>
        <span className="text-xs text-gray-500">
          <span className={over ? 'text-red-400 font-bold' : 'text-white font-semibold'}>
            {consumed}
          </span>
          <span className="text-gray-600"> / {target}{unit}</span>
          {!over && (
            <span className="text-gray-600"> · {remaining}{unit} left</span>
          )}
          {over && (
            <span className="text-red-400 font-semibold"> +{consumed - target}{unit} over</span>
          )}
        </span>
      </div>
      {/* Track */}
      <div className="h-2.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : color}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Intake {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

const EMPTY: Intake = { calories: 0, protein: 0, carbs: 0, fat: 0 };

interface SyncWearableButtonProps {
  onActiveBurn: (kcal: number) => void;
}

function SyncWearableButton({ onActiveBurn }: SyncWearableButtonProps) {
  const [syncing, setSyncing]     = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [synced, setSynced]       = useState(false);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSynced(false);
    try {
      const res = await fetch(`/api/sync/google-fit?date=${today()}`);
      const data = await res.json() as { activeCalories?: number; error?: string; message?: string };
      if (!res.ok) {
        if (data.error === 'not_connected' || data.error === 'token_expired') {
          window.location.href = '/api/auth/google/login';
          return;
        }
        throw new Error(data.message ?? 'Sync failed');
      }
      onActiveBurn(data.activeCalories ?? 0);
      setSynced(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                   bg-violet-600/20 border border-violet-500/40 text-violet-300
                   hover:bg-violet-600/30 active:bg-violet-600/40
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {syncing ? (
          <>
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
            </svg>
            Syncing…
          </>
        ) : synced ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Connected ✓
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Sync Wearable
          </>
        )}
      </button>
      {syncError && <p className="text-xs text-red-400">{syncError}</p>}
    </div>
  );
}

export default function DietTracker() {
  const [logged, setLogged]   = useState<Intake>(EMPTY);
  const [form,   setForm]     = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [saving, setSaving]   = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'err'>('idle');
  const [scanning, setScanning]   = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [preview, setPreview]     = useState<string | null>(null);
  const [activeBurn, setActiveBurn] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleActiveBurn = useCallback((kcal: number) => setActiveBurn(kcal), []);

  // Load today's data on mount
  useEffect(() => {
    fetch('/api/logs?days=1')
      .then((r) => r.json())
      .then((rows: Array<{ date: string; caloriesIn: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }>) => {
        const todayRow = rows.find((r) => r.date === today());
        if (todayRow) {
          setLogged({
            calories: todayRow.caloriesIn ?? 0,
            protein:  todayRow.proteinG   ?? 0,
            carbs:    todayRow.carbsG     ?? 0,
            fat:      todayRow.fatG       ?? 0,
          });
          setForm({
            calories: todayRow.caloriesIn?.toString() ?? '',
            protein:  todayRow.proteinG?.toString()   ?? '',
            carbs:    todayRow.carbsG?.toString()     ?? '',
            fat:      todayRow.fatG?.toString()       ?? '',
          });
        }
      })
      .catch(() => {/* silently fail — network may be unavailable in dev */});
  }, []);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setScanStatus('idle');
    setScanning(true);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URL prefix → keep only the base64 payload
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type || 'image/jpeg' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const macros = await res.json() as { calories: number; protein: number; carbs: number; fat: number };

      // Auto-fill the form fields
      setForm({
        calories: macros.calories > 0 ? String(macros.calories) : '',
        protein:  macros.protein  > 0 ? String(macros.protein)  : '',
        carbs:    macros.carbs    > 0 ? String(macros.carbs)    : '',
        fat:      macros.fat      > 0 ? String(macros.fat)      : '',
      });
      setScanStatus('ok');
    } catch {
      setScanStatus('err');
    } finally {
      setScanning(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:         today(),
          calories_in:  Number(form.calories) || null,
          protein_g:    Number(form.protein)  || null,
          carbs_g:      Number(form.carbs)    || null,
          fat_g:        Number(form.fat)      || null,
        }),
      });
      if (!res.ok) throw new Error('API error');
      setLogged({
        calories: Number(form.calories) || 0,
        protein:  Number(form.protein)  || 0,
        carbs:    Number(form.carbs)    || 0,
        fat:      Number(form.fat)      || 0,
      });
      setStatus('ok');
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  }

  const calPct = pct(logged.calories, TARGETS.calories);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Nutrition</h2>
        <p className="text-xs text-gray-500 mt-0.5">Daily targets & intake</p>
      </div>

      {/* Calorie ring-style hero */}
      <div
        className="rounded-2xl p-5 flex items-center gap-5"
        style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      >
        {/* Circular progress (SVG) */}
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            {/* track */}
            <circle cx="40" cy="40" r="32" fill="none" stroke="#2a2f45" strokeWidth="8" />
            {/* progress */}
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={calPct > 100 ? '#ef4444' : '#7c3aed'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={`${2 * Math.PI * 32 * (1 - clamp(calPct) / 100)}`}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black tabular-nums text-white leading-none">
              {calPct}%
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Calories</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tabular-nums text-white">{logged.calories}</span>
            <span className="text-sm text-gray-500">/ {TARGETS.calories} kcal</span>
          </div>
          <span className="text-xs text-gray-500">
            {logged.calories <= TARGETS.calories
              ? `${TARGETS.calories - logged.calories} kcal remaining`
              : `${logged.calories - TARGETS.calories} kcal over target`}
          </span>
        </div>
      </div>

      {/* Macro progress bars */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2f45' }}
      >
        <MacroBar label="Protein" consumed={logged.protein} target={TARGETS.protein} unit="g" color="bg-blue-500" />
        <MacroBar label="Carbs"   consumed={logged.carbs}   target={TARGETS.carbs}   unit="g" color="bg-amber-500" />
        <MacroBar label="Fat"     consumed={logged.fat}     target={TARGETS.fat}     unit="g" color="bg-rose-500" />
      </div>

      {/* Active burn banner (shown after wearable sync) */}
      {activeBurn !== null && (() => {
        // How much extra to eat back: 50% of active burn, capped at 500 kcal.
        // Your calorie target (1850) already includes a planned deficit from TDEE.
        // Eating back 100% of active burn would erase that deficit entirely.
        // The 50% rule preserves most of the deficit while avoiding excessive under-eating.
        const eatBack     = Math.min(Math.round(activeBurn * 0.5), 500);
        const adjustedTarget = TARGETS.calories + eatBack;
        const isHigh      = activeBurn >= 600;

        return (
          <div
            className="rounded-xl px-4 py-3 flex flex-col gap-1"
            style={{ backgroundColor: '#1f1a0e', border: '1px solid #78350f' }}
          >
            <p className="text-xs font-semibold text-amber-400">
              🔥 Active burn today: {activeBurn.toLocaleString()} kcal
            </p>
            {isHigh ? (
              <>
                <p className="text-xs text-amber-300/80">
                  That's a big output. Eating back ~50% ({eatBack} kcal) keeps your deficit healthy
                  without wiping it out. Suggested intake today:{' '}
                  <span className="font-bold text-amber-300">{adjustedTarget.toLocaleString()} kcal</span>.
                </p>
                <p className="text-[10px] text-amber-300/40 mt-0.5">
                  Eating back 100% ({(TARGETS.calories + activeBurn).toLocaleString()} kcal) would
                  erase your planned deficit entirely.
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-300/70">
                Deficit is on track. No adjustment needed — your target stays{' '}
                <span className="font-bold text-amber-300">{TARGETS.calories.toLocaleString()} kcal</span>.
              </p>
            )}
          </div>
        );
      })()}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Section header + scan button */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Log today's intake
          </span>
          <div className="flex items-center gap-2">
          <SyncWearableButton onActiveBurn={handleActiveBurn} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                       bg-violet-600/20 border border-violet-500/40 text-violet-300
                       hover:bg-violet-600/30 active:bg-violet-600/40
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scanning ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
                </svg>
                Scanning…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Scan Meal
              </>
            )}
          </button>
          {/* Hidden file input — accept images, prefer camera on mobile */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageChange}
          />
          </div>
        </div>

        {/* Image preview + scan feedback */}
        {preview && (
          <div className="relative rounded-xl overflow-hidden border border-gray-700">
            <img src={preview} alt="Meal preview" className="w-full max-h-48 object-cover" />
            {scanning && (
              <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                <span className="text-sm font-semibold text-violet-300 animate-pulse">Analyzing…</span>
              </div>
            )}
            {scanStatus === 'ok' && (
              <div className="absolute bottom-0 inset-x-0 bg-green-500/20 border-t border-green-500/40 px-3 py-1.5">
                <p className="text-xs font-semibold text-green-400">✓ Macros detected — fields pre-filled</p>
              </div>
            )}
            {scanStatus === 'err' && (
              <div className="absolute bottom-0 inset-x-0 bg-red-500/20 border-t border-red-500/40 px-3 py-1.5">
                <p className="text-xs font-semibold text-red-400">⚠ Could not analyze image — fill manually</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {([ ['calories', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'] ] as [keyof typeof form, string][]).map(
            ([key, placeholder]) => (
              <input
                key={key}
                type="number"
                min="0"
                step={key === 'calories' ? '1' : '0.1'}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-3
                           text-white placeholder-gray-600 text-sm
                           focus:outline-none focus:border-violet-500 transition-colors"
              />
            )
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white
                     transition-colors hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Intake'}
        </button>

        {status === 'ok'  && <p className="text-xs text-green-400 text-center">Saved ✓</p>}
        {status === 'err' && <p className="text-xs text-red-400  text-center">Failed to save. Try again.</p>}
      </form>
    </div>
  );
}
