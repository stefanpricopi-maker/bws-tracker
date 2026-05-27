import { useState } from 'react';
import WeightTrend      from './WeightTrend';
import DietTracker      from './DietTracker';
import StepTracker      from './StepTracker';
import WorkoutLogger    from './WorkoutLogger';
import BWSScore         from './BWSScore';
import ProfileSettings  from './ProfileSettings';
import AlertBanner      from './AlertBanner';
import WeeklySummary    from './WeeklySummary';

// ── Tab definitions ────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'workout' | 'diet' | 'profile';

interface NavItem {
  id:    Tab;
  label: string;
  icon:  string;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞'  },
  { id: 'workout',   label: 'Workout',   icon: '🏋'  },
  { id: 'diet',      label: 'Diet',      icon: '🥗'  },
  { id: 'profile',   label: 'Profile',   icon: '👤'  },
];

// ── Dashboard tab content ──────────────────────────────────────────────────

function DashboardTab() {
  return (
    <div className="flex flex-col gap-8">
      <AlertBanner />
      <WeeklySummary />
      <BWSScore />
      <hr style={{ borderColor: '#2a2f45' }} />
      <WeightTrend />
      <hr style={{ borderColor: '#2a2f45' }} />
      <StepTracker />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [active, setActive] = useState<Tab>('dashboard');

  return (
    <>
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
        {active === 'workout'   && <WorkoutLogger />}
        {active === 'diet'      && <DietTracker />}
        {active === 'profile'   && <ProfileSettings />}
      </div>
    </>
  );
}
