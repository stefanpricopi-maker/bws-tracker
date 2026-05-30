import { useState } from 'react';
import { useBendSession } from '../useBendSession';
import { sessionProgress, todayDateString } from '../bendService';
import BendRoutineSelector from './BendRoutineSelector';
import StretchTimer from './StretchTimer';

const DURATION_STEPS = [-15, -5, 5, 15];

export default function BendSessionTracker() {
  const {
    session,
    loading,
    saving,
    error,
    startFromRoutine,
    startCustom,
    updatePose,
    togglePose,
    completeSession,
    updateNotes,
  } = useBendSession();

  const [expandedPose, setExpandedPose] = useState<number | null>(0);
  const [notesDraft, setNotesDraft] = useState('');

  const today = todayDateString();
  const progress = session ? sessionProgress(session) : null;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-gray-800/40 border border-gray-700/40" />
        <div className="h-48 rounded-2xl bg-gray-800/40 border border-gray-700/40" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4 pb-6" data-testid="bend-session-tracker">
        <header>
          <h2 className="text-lg font-bold text-white">Bend</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Mobilitate & stretching · {today}
          </p>
        </header>
        {error && (
          <div className="rounded-xl px-4 py-3 bg-red-900/30 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}
        <BendRoutineSelector
          disabled={saving}
          onSelectRoutine={(r) => void startFromRoutine(r)}
          onAddCustomPose={() => {}}
          onStartCustom={(name, poses) => void startCustom(name, poses)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6" data-testid="bend-session-tracker">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{session.routineName}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {session.date}
            {' · '}
            {new Date(session.timestamp).toLocaleTimeString('ro-RO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {progress && (
            <p className="text-[11px] text-teal-400/90 mt-1">
              {progress.done}/{progress.total} poziții
              {session.completed && ' · sesiune completă ✓'}
            </p>
          )}
        </div>
        {saving && (
          <span className="text-[10px] text-gray-500 shrink-0">Se salvează…</span>
        )}
      </header>

      {error && (
        <div className="rounded-xl px-4 py-3 bg-red-900/30 border border-red-500/30 text-red-300 text-xs">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {session.poses.map((pose, index) => {
          const expanded = expandedPose === index;
          const actual = pose.actualDurationSeconds ?? 0;

          return (
            <div
              key={`${pose.poseName}-${index}`}
              className={`rounded-2xl border p-4 transition-colors ${
                pose.completed
                  ? 'border-emerald-500/30 bg-emerald-950/20'
                  : 'border-gray-700/60 bg-gray-800/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => void togglePose(index)}
                  className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0
                    ${pose.completed
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-gray-600 text-transparent hover:border-teal-500'
                    }`}
                  aria-label={pose.completed ? 'Marchează nefăcut' : 'Marchează făcut'}
                >
                  ✓
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setExpandedPose(expanded ? null : index)}
                    className="w-full text-left"
                  >
                    <p className={`text-sm font-semibold ${pose.completed ? 'text-emerald-200' : 'text-white'}`}>
                      {pose.poseName}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Țintă {pose.targetDurationSeconds}s
                      {pose.actualDurationSeconds != null && (
                        <> · efectiv {pose.actualDurationSeconds}s</>
                      )}
                    </p>
                  </button>

                  {expanded && (
                    <div className="mt-3 flex flex-col gap-3">
                      <StretchTimer
                        targetSeconds={pose.targetDurationSeconds}
                        actualSeconds={pose.actualDurationSeconds}
                        disabled={saving}
                        onComplete={(seconds) => {
                          void updatePose(index, {
                            actualDurationSeconds: seconds,
                            completed: seconds >= pose.targetDurationSeconds * 0.8,
                          });
                        }}
                      />

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Durată (s)
                        </span>
                        {DURATION_STEPS.map((step) => (
                          <button
                            key={step}
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              const next = Math.max(0, actual + step);
                              void updatePose(index, { actualDurationSeconds: next });
                            }}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-gray-800 border border-gray-700
                                       text-gray-300 hover:text-white disabled:opacity-50"
                          >
                            {step > 0 ? `+${step}` : step}
                          </button>
                        ))}
                        <span className="text-sm font-bold tabular-nums text-white ml-auto">
                          {actual}s
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void updatePose(index, {
                          actualDurationSeconds: pose.targetDurationSeconds,
                          completed: true,
                        })}
                        className="w-full py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 border
                                   border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
                      >
                        Marchează ținta ({pose.targetDurationSeconds}s) ✓
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-3 flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-wider text-gray-500">
          Note (opțional)
        </label>
        <textarea
          value={notesDraft || session.notes || ''}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => {
            if (notesDraft !== (session.notes ?? '')) {
              void updateNotes(notesDraft);
            }
          }}
          rows={2}
          placeholder="Cum te-ai simțit dimineața?"
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white resize-none
                     focus:outline-none focus:border-teal-500"
        />
      </div>

      {!session.completed && progress && progress.done === progress.total && progress.total > 0 && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void completeSession()}
          className="w-full py-3 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-500
                     disabled:opacity-50"
          data-testid="bend-complete-session"
        >
          Finalizează sesiunea ✓
        </button>
      )}

      {session.completed && (
        <div className="rounded-xl px-4 py-3 bg-teal-900/30 border border-teal-500/30 text-center">
          <p className="text-sm font-semibold text-teal-200">Sesiune completă — bună dimineața! 🧘</p>
        </div>
      )}
    </div>
  );
}
