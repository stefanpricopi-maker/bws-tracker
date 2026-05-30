import { useEffect, useRef, useState } from 'react';

interface StretchTimerProps {
  targetSeconds: number;
  actualSeconds?: number;
  onComplete: (actualSeconds: number) => void;
  disabled?: boolean;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StretchTimer({
  targetSeconds,
  actualSeconds,
  onComplete,
  disabled = false,
}: StretchTimerProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(actualSeconds ?? 0);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (actualSeconds != null) setElapsed(actualSeconds);
  }, [actualSeconds]);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  function stopTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function handleStart() {
    if (disabled) return;
    startedAtRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
    stopTick();
    tickRef.current = setInterval(() => {
      if (startedAtRef.current == null) return;
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
  }

  function handlePause() {
    setRunning(false);
    stopTick();
  }

  function handleReset() {
    setRunning(false);
    stopTick();
    startedAtRef.current = null;
    setElapsed(0);
  }

  function handleFinish() {
    handlePause();
    onComplete(elapsed);
  }

  const remaining = Math.max(0, targetSeconds - elapsed);
  const atTarget = elapsed >= targetSeconds;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-teal-950/30 border border-teal-500/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-teal-400/80">Timer</p>
          <p className="text-lg font-bold tabular-nums text-white">{formatTime(elapsed)}</p>
          <p className="text-[10px] text-gray-500">
            Țintă {formatTime(targetSeconds)}
            {!atTarget && running && ` · rămân ${formatTime(remaining)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {!running ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={disabled}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white
                         hover:bg-teal-500 disabled:opacity-50"
            >
              ▶ Start
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 text-white hover:bg-gray-600"
            >
              ⏸ Pauză
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300
                       border border-gray-700 hover:text-white disabled:opacity-50"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={disabled || elapsed === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 text-white
                       hover:bg-emerald-500 disabled:opacity-50"
          >
            ✓ Gata
          </button>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${atTarget ? 'bg-emerald-500' : 'bg-teal-500'}`}
          style={{ width: `${Math.min(100, (elapsed / Math.max(1, targetSeconds)) * 100)}%` }}
        />
      </div>
    </div>
  );
}
