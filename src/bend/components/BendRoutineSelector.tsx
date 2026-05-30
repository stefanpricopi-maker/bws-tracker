import { useState } from 'react';
import { BEND_ROUTINES, type BendRoutineTemplate } from '../routines';

interface BendRoutineSelectorProps {
  onSelectRoutine: (routine: BendRoutineTemplate) => void;
  onAddCustomPose: (poseName: string, targetSeconds: number) => void;
  onStartCustom: (routineName: string, poses: Array<{ poseName: string; targetDurationSeconds: number }>) => void;
  disabled?: boolean;
}

const DURATION_PRESETS = [30, 45, 60, 90];

export default function BendRoutineSelector({
  onSelectRoutine,
  onAddCustomPose,
  onStartCustom,
  disabled = false,
}: BendRoutineSelectorProps) {
  const [customName, setCustomName] = useState('');
  const [customPose, setCustomPose] = useState('');
  const [customSeconds, setCustomSeconds] = useState(45);
  const [draftPoses, setDraftPoses] = useState<Array<{ poseName: string; targetDurationSeconds: number }>>([]);

  function addToDraft() {
    const name = customPose.trim();
    if (!name) return;
    setDraftPoses((prev) => [...prev, { poseName: name, targetDurationSeconds: customSeconds }]);
    setCustomPose('');
    onAddCustomPose(name, customSeconds);
  }

  function startDraft() {
    const name = customName.trim() || 'Custom Routine';
    if (draftPoses.length === 0) return;
    onStartCustom(name, draftPoses);
    setDraftPoses([]);
    setCustomName('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
          Rutine predefinite
        </p>
        <div className="flex flex-col gap-2">
          {BEND_ROUTINES.map((routine) => (
            <button
              key={routine.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectRoutine(routine)}
              className="text-left rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3
                         hover:border-teal-500/40 hover:bg-teal-950/20 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-white">{routine.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{routine.description}</p>
              <p className="text-[10px] text-teal-400/80 mt-1">{routine.poses.length} poziții</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 bg-gray-800/30 p-4 flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Rutină personalizată
        </p>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Nume rutină (opțional)"
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white
                     focus:outline-none focus:border-teal-500"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={customPose}
            onChange={(e) => setCustomPose(e.target.value)}
            placeholder="Poziție (ex: Couch Stretch)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white
                       focus:outline-none focus:border-teal-500"
          />
          <select
            value={customSeconds}
            onChange={(e) => setCustomSeconds(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-xl px-2 py-2 text-sm text-white"
          >
            {DURATION_PRESETS.map((s) => (
              <option key={s} value={s}>{s}s</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addToDraft}
            disabled={disabled || !customPose.trim()}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-700 text-white hover:bg-gray-600
                       disabled:opacity-50"
          >
            + Adaugă poziție
          </button>
          <button
            type="button"
            onClick={startDraft}
            disabled={disabled || draftPoses.length === 0}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-teal-600 text-white hover:bg-teal-500
                       disabled:opacity-50"
          >
            Start ({draftPoses.length})
          </button>
        </div>
        {draftPoses.length > 0 && (
          <ul className="text-[11px] text-gray-400 space-y-0.5">
            {draftPoses.map((p, i) => (
              <li key={`${p.poseName}-${i}`}>· {p.poseName} ({p.targetDurationSeconds}s)</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
