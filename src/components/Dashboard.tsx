import { useState, useEffect } from 'react';
import WeightTrend          from './WeightTrend';
import DietTracker          from './DietTracker';
import StepTracker          from './StepTracker';
import WorkoutLogger        from './WorkoutLogger';
import BWSScore             from './BWSScore';
import ProfileSettings      from './ProfileSettings';
import AlertBanner          from './AlertBanner';
import WeeklySummary        from './WeeklySummary';
import ConsistencyHeatmap   from './ConsistencyHeatmap';
import WeeklyCheckIn        from './WeeklyCheckIn';
import PhotoVault           from './PhotoVault';
import GoalForecaster       from './GoalForecaster';
import ExerciseManager      from './ExerciseManager';
import WorkoutPlayer        from './WorkoutPlayer';
import type { PlannedExercise } from './WorkoutPlayer';
import DailyActionHero      from './DailyActionHero';
import Onboarding, { needsOnboarding, markOnboardingDone } from './Onboarding';

// ── Tab definitions ────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'workout' | 'diet' | 'stats' | 'profile';

interface NavItem {
  id:    Tab;
  label: string;
  icon:  string;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home',    icon: '🏠'  },
  { id: 'workout',   label: 'Workout', icon: '🏋'  },
  { id: 'diet',      label: 'Diet',    icon: '🥗'  },
  { id: 'stats',     label: 'Stats',   icon: '📊'  },
  { id: 'profile',   label: 'Profile', icon: '👤'  },
];

// ── Dashboard tab content ──────────────────────────────────────────────────

interface DashboardTabProps {
  onNavigate: (tab: Tab) => void;
}

function DashboardTab({ onNavigate }: DashboardTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <DailyActionHero onNavigate={onNavigate} />
      <StepTracker />

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 px-0.5">
          Insights
        </p>
        <AlertBanner />
        <GoalForecaster />
        <ConsistencyHeatmap />
        <WeeklyCheckIn />
        <WeeklySummary />
      </div>
    </div>
  );
}

// ── Stats tab ─────────────────────────────────────────────────────────────

function StatsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-white">Statistics</h2>
        <p className="text-xs text-gray-500 mt-0.5">Performance, body weight & trends</p>
      </div>
      <BWSScore />
      <hr style={{ borderColor: '#1f2937' }} />
      <WeightTrend />
    </div>
  );
}

// ── Profile tab (settings + progress photos) ──────────────────────────────

function ProfileTab() {
  const [sub, setSub] = useState<'settings' | 'photos'>('settings');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-xl bg-gray-800 border border-gray-700 p-1 gap-1">
        {(['settings', 'photos'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors
              ${sub === s ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {s === 'settings' ? '⚙️ Settings' : '📸 Progress Photos'}
          </button>
        ))}
      </div>
      {sub === 'settings' && <ProfileSettings />}
      {sub === 'photos'   && <PhotoVault />}
    </div>
  );
}

// ── Workout tab (sub-tabs: Log / Library) ─────────────────────────────────

interface WorkoutTabProps {
  onStartPlayer: (exercises: PlannedExercise[], dayType: string) => void;
}

function WorkoutTab({ onStartPlayer }: WorkoutTabProps) {
  const [sub, setSub] = useState<'log' | 'library'>('log');
  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab toggle */}
      <div className="flex rounded-xl bg-gray-800 border border-gray-700 p-1 gap-1">
        {(['log', 'library'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors capitalize
              ${sub === s ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {s === 'log' ? '🏋 Log Workout' : '📚 Exercise Library'}
          </button>
        ))}
      </div>
      {sub === 'log'     && <WorkoutLogger onStartPlayer={onStartPlayer} />}
      {sub === 'library' && <ExerciseManager />}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const GOOGLE_AUTH_MESSAGES: Record<string, { text: string; color: string }> = {
  success:        { text: '✅ Google Fit connected successfully!', color: 'bg-emerald-900 border-emerald-500 text-emerald-200' },
  denied:         { text: '⚠️ Google Fit access was denied. Try connecting again.', color: 'bg-amber-900 border-amber-500 text-amber-200' },
  error:          { text: '❌ Google Fit connection failed. Check the server logs.', color: 'bg-red-900 border-red-500 text-red-200' },
  not_configured: { text: '⚙️ Google Fit is not configured on this server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel environment variables.', color: 'bg-blue-900 border-blue-500 text-blue-200' },
};

interface PlayerState {
  exercises: PlannedExercise[];
  dayType:   string;
}

export default function Dashboard() {
  const [active, setActive]         = useState<Tab>('dashboard');
  const [googleAuthMsg, setGoogleAuthMsg] = useState<{ text: string; color: string } | null>(null);
  const [player, setPlayer]         = useState<PlayerState | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  function startPlayer(exercises: PlannedExercise[], dayType: string) {
    setPlayer({ exercises, dayType });
  }

  function closePlayer() {
    setPlayer(null);
  }

  function completePlayer() {
    setPlayer(null);
    setActive('dashboard');
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('google_auth');
    if (status && GOOGLE_AUTH_MESSAGES[status]) {
      setGoogleAuthMsg(GOOGLE_AUTH_MESSAGES[status]);
      // clean up URL without reload
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }
  }, []);

  // Show onboarding for first-time users (skip if goals already configured)
  useEffect(() => {
    if (!needsOnboarding()) return;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((profile: { goals?: { targetWeightKg?: number | null } | null }) => {
        if (profile.goals?.targetWeightKg != null) {
          markOnboardingDone();
          return;
        }
        fetch('/api/logs?days=30')
          .then((r2) => r2.json())
          .then((logs: Array<{ weight_kg?: number | null }>) => {
            const hasWeight = logs.some((l) => l.weight_kg != null);
            if (hasWeight) markOnboardingDone();
            else setShowOnboarding(true);
          })
          .catch(() => setShowOnboarding(true));
      })
      .catch(() => setShowOnboarding(true));
  }, []);

  return (
    <>
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}

      {/* WorkoutPlayer full-screen overlay */}
      {player && (
        <WorkoutPlayer
          exercises={player.exercises}
          dayType={player.dayType}
          onComplete={completePlayer}
          onClose={closePlayer}
        />
      )}

      {/* Google Auth status banner */}
      {googleAuthMsg && (
        <div className={`mx-4 mt-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${googleAuthMsg.color}`}>
          <span className="flex-1">{googleAuthMsg.text}</span>
          <button
            type="button"
            onClick={() => setGoogleAuthMsg(null)}
            className="ml-2 text-current opacity-60 hover:opacity-100"
          >✕</button>
        </div>
      )}

      {/* Top navigation bar */}
      <nav
        className="sticky top-0 z-50 w-full
                   flex items-center justify-around
                   border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm
                   h-14"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium
                        transition-colors duration-150 bg-transparent border-0 cursor-pointer
                        ${active === id ? 'text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8">
        {active === 'dashboard' && <DashboardTab onNavigate={setActive} />}
        {active === 'workout'   && <WorkoutTab onStartPlayer={startPlayer} />}
        {active === 'diet'      && <DietTracker />}
        {active === 'stats'     && <StatsTab />}
        {active === 'profile'   && <ProfileTab />}
      </div>
    </>
  );
}
