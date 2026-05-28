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

// ── Tab definitions ────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'workout' | 'diet' | 'photos' | 'profile';

interface NavItem {
  id:    Tab;
  label: string;
  icon:  string;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home',    icon: '⊞'  },
  { id: 'workout',   label: 'Workout', icon: '🏋'  },
  { id: 'diet',      label: 'Diet',    icon: '🥗'  },
  { id: 'photos',    label: 'Photos',  icon: '📸'  },
  { id: 'profile',   label: 'Profile', icon: '👤'  },
];

// ── Dashboard tab content ──────────────────────────────────────────────────

function DashboardTab() {
  return (
    <div className="flex flex-col gap-8">
      <AlertBanner />
      <GoalForecaster />
      <ConsistencyHeatmap />
      <WeeklyCheckIn />
      <WeeklySummary />
      <BWSScore />
      <hr style={{ borderColor: '#2a2f45' }} />
      <WeightTrend />
      <hr style={{ borderColor: '#2a2f45' }} />
      <StepTracker />
    </div>
  );
}

// ── Workout tab (sub-tabs: Log / Library) ─────────────────────────────────

function WorkoutTab() {
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
      {sub === 'log'     && <WorkoutLogger />}
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

export default function Dashboard() {
  const [active, setActive] = useState<Tab>('dashboard');
  const [googleAuthMsg, setGoogleAuthMsg] = useState<{ text: string; color: string } | null>(null);

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

  return (
    <>
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
        {active === 'dashboard' && <DashboardTab />}
        {active === 'workout'   && <WorkoutTab />}
        {active === 'diet'      && <DietTracker />}
        {active === 'photos'    && <PhotoVault />}
        {active === 'profile'   && <ProfileSettings />}
      </div>
    </>
  );
}
