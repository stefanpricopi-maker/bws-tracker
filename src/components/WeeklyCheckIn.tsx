import { useState } from 'react';

type Status = 'idle' | 'loading' | 'ok' | 'no_key' | 'error';

interface CoachResponse {
  advice:      string;
  weightDelta: number | null;
  error?:      string;
}

export default function WeeklyCheckIn() {
  const [status,  setStatus]  = useState<Status>('idle');
  const [advice,  setAdvice]  = useState<string | null>(null);
  const [delta,   setDelta]   = useState<number | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  async function handleGenerate() {
    setStatus('loading');
    setAdvice(null);
    setErrMsg(null);

    try {
      const res = await fetch('/api/ai-coach');
      let data: CoachResponse = {} as CoachResponse;
      try {
        data = await res.json();
      } catch {
        setErrMsg('Server returned an invalid response. Try again.');
        setStatus('error');
        return;
      }

      if (!res.ok || data.error) {
        if (res.status === 503) {
          setStatus('no_key');
        } else {
          setErrMsg(data.error ?? 'Unknown error');
          setStatus('error');
        }
        return;
      }

      setAdvice(data.advice);
      setDelta(data.weightDelta ?? null);
      setStatus('ok');
    } catch (e) {
      setErrMsg(String(e));
      setStatus('error');
    }
  }

  const deltaStr = delta !== null
    ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)} kg this week`
    : null;

  return (
    <div className="rounded-2xl bg-gray-800/40 border border-gray-700/40 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">AI Coach</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Built With Science · Weekly check-in</p>
        </div>
        <span className="text-2xl">🤖</span>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={status === 'loading'}
        className="w-full min-h-[46px] rounded-xl font-semibold text-sm transition-all duration-150
                   bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
      >
        {status === 'loading' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
            </svg>
            Analyzing last 7 days…
          </>
        ) : status === 'ok' ? (
          '↻ Regenerate Analysis'
        ) : (
          '⚡ Generate Weekly AI Analysis'
        )}
      </button>

      {/* Response card */}
      {status === 'ok' && advice && (
        <div className="rounded-xl bg-violet-950/50 border border-violet-700/40 p-4 flex flex-col gap-2">
          {deltaStr && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                ${delta! < 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : delta! > 0.1 ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                {deltaStr}
              </span>
            </div>
          )}
          <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{advice}</p>
        </div>
      )}

      {/* No API key */}
      {status === 'no_key' && (
        <div className="rounded-xl bg-amber-950/40 border border-amber-700/40 p-4">
          <p className="text-sm font-semibold text-amber-400 mb-1">AI key not configured</p>
          <p className="text-xs text-amber-300/70">
            Add <code className="bg-amber-900/40 px-1 rounded">AI_API_KEY</code> to your{' '}
            <code className="bg-amber-900/40 px-1 rounded">.env</code> file and rebuild the container.
            Supports any OpenAI-compatible API (OpenAI, Groq, OpenRouter, etc.).
          </p>
        </div>
      )}

      {/* Generic error */}
      {status === 'error' && (
        <div className="rounded-xl bg-red-950/40 border border-red-700/40 p-4">
          <p className="text-sm font-semibold text-red-400 mb-1">Analysis failed</p>
          <p className="text-xs text-red-300/70 break-all">{errMsg}</p>
        </div>
      )}
    </div>
  );
}
