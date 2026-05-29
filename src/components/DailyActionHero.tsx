import { useState, useEffect } from 'react';

type Tab = 'dashboard' | 'workout' | 'diet' | 'stats' | 'profile';

interface DailyStatus {
  date: string;
  userName: string;
  weightLogged: boolean;
  mealsLogged: boolean;
  stepsLogged: boolean;
  stepsCount: number;
  workoutDone: boolean;
  todaySplit: {
    index: number;
    label: string;
    dayType: string;
    isRest: boolean;
  };
  targetWeightKg: number | null;
  targetSteps: number;
  tasks: Array<{ id: string; done: boolean }>;
  completedCount: number;
  totalTasks: number;
}

interface DailyActionHeroProps {
  onNavigate: (tab: Tab) => void;
  refreshToken?: number;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDateLong(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

interface PrimaryAction {
  icon: string;
  title: string;
  subtitle: string;
  cta: string;
  tab: Tab;
}

function pickPrimaryAction(s: DailyStatus): PrimaryAction {
  if (!s.weightLogged) {
    return {
      icon: '⚖️',
      title: 'Log your weight',
      subtitle: 'Takes 10 seconds — unlocks your trend chart',
      cta: 'Log weight',
      tab: 'stats',
    };
  }
  if (!s.todaySplit.isRest && !s.workoutDone) {
    return {
      icon: '🏋',
      title: `Train: ${s.todaySplit.label}`,
      subtitle: `${s.todaySplit.dayType} day — open the logger or start the player`,
      cta: 'Go to workout',
      tab: 'workout',
    };
  }
  if (!s.mealsLogged) {
    return {
      icon: '🥗',
      title: 'Log your meals',
      subtitle: 'Track calories and macros for today',
      cta: 'Log meals',
      tab: 'diet',
    };
  }
  if (!s.stepsLogged) {
    const left = Math.max(0, s.targetSteps - s.stepsCount);
    return {
      icon: '👟',
      title: left > 0 ? `${left.toLocaleString()} steps to go` : 'Sync your steps',
      subtitle: `Daily NEAT target: ${s.targetSteps.toLocaleString()} steps`,
      cta: 'Log steps',
      tab: 'dashboard',
    };
  }
  return {
    icon: '✅',
    title: 'All done for today!',
    subtitle: s.todaySplit.isRest
      ? 'Rest day complete — recovery is part of the plan'
      : 'Weight, workout, meals & steps logged. Great work.',
    cta: 'View stats',
    tab: 'stats',
  };
}

const TASK_LABELS: Record<string, { label: string; icon: string }> = {
  weight:  { label: 'Weight',  icon: '⚖️' },
  workout: { label: 'Workout', icon: '🏋' },
  meals:   { label: 'Meals',   icon: '🥗' },
  steps:   { label: 'Steps',   icon: '👟' },
};

export default function DailyActionHero({ onNavigate, refreshToken = 0 }: DailyActionHeroProps) {
  const [status, setStatus]   = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/daily-status')
      .then((r) => r.json())
      .then((d) => setStatus(d as DailyStatus))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [refreshToken]);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-5 animate-pulse"
        style={{ background: 'linear-gradient(135deg, #2d1b69 0%, #1a1d27 100%)', border: '1px solid #4c1d95' }}
      >
        <div className="h-4 w-32 bg-gray-700 rounded mb-3" />
        <div className="h-8 w-56 bg-gray-700 rounded mb-2" />
        <div className="h-4 w-40 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!status) return null;

  const action   = pickPrimaryAction(status);
  const allDone  = status.completedCount === status.totalTasks;
  const pct      = Math.round((status.completedCount / status.totalTasks) * 100);

  return (
    <div className="flex flex-col gap-3">
      {/* Greeting */}
      <div>
        <p className="text-xs text-gray-500">{formatDateLong(status.date)}</p>
        <h1 className="text-xl font-bold text-white mt-0.5">
          {greeting()}, {status.userName.split(' ')[0]}
        </h1>
      </div>

      {/* Hero card */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{
          background: allDone
            ? 'linear-gradient(135deg, #064e3b 0%, #1a1d27 100%)'
            : 'linear-gradient(135deg, #4c1d95 0%, #1a1d27 100%)',
          border: `1px solid ${allDone ? '#059669' : '#6d28d9'}`,
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none mt-0.5">{action.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300/80 mb-0.5">
              {allDone ? 'Day complete' : "Today's action"}
            </p>
            <p className="text-lg font-bold text-white leading-tight">{action.title}</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{action.subtitle}</p>
          </div>
        </div>

        {/* Progress ring text */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${allDone ? 'bg-emerald-500' : 'bg-violet-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-400 shrink-0">
            {status.completedCount}/{status.totalTasks}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNavigate(action.tab)}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors
            ${allDone
              ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/40'
              : 'bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700'
            }`}
        >
          {action.cta} →
        </button>
      </div>

      {/* Task checklist */}
      <div className="grid grid-cols-2 gap-2">
        {status.tasks.map((task) => {
          const meta = TASK_LABELS[task.id];
          if (!meta) return null;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => {
                const tab: Tab =
                  task.id === 'weight'  ? 'stats' :
                  task.id === 'workout' ? 'workout' :
                  task.id === 'meals'   ? 'diet' :
                  'dashboard';
                onNavigate(tab);
              }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors
                border ${task.done
                  ? 'bg-emerald-900/20 border-emerald-600/30'
                  : 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600'
                }`}
            >
              <span className="text-base leading-none">{task.done ? '✓' : meta.icon}</span>
              <span className={`text-xs font-semibold ${task.done ? 'text-emerald-400 line-through' : 'text-gray-300'}`}>
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>

      {status.targetWeightKg != null && (
        <p className="text-[11px] text-gray-600 text-center">
          Goal weight: <span className="text-gray-400 font-semibold">{status.targetWeightKg} kg</span>
          {' · '}{status.todaySplit.label}
        </p>
      )}
    </div>
  );
}
