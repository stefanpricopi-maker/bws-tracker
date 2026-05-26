import { useState } from 'react';
import WeightTrend  from './WeightTrend';
import DietTracker  from './DietTracker';
import StepTracker  from './StepTracker';

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

// ── Workout stub ───────────────────────────────────────────────────────────

function WorkoutStub() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center text-gray-500">
      <span className="text-5xl">🏋️</span>
      <p className="font-semibold text-white">Workout Logger</p>
      <p className="text-sm max-w-xs">
        Coming in Phase 4 — Push / Pull / Legs logging with progressive overload tracking.
      </p>
    </div>
  );
}

// ── Profile stub ───────────────────────────────────────────────────────────

function ProfileStub() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center text-gray-500">
      <span className="text-5xl">👤</span>
      <p className="font-semibold text-white">Profile</p>
      <p className="text-sm max-w-xs">
        Coming in a later phase — user settings, goals, and TDEE configuration.
      </p>
    </div>
  );
}

// ── Dashboard tab content ──────────────────────────────────────────────────

function DashboardTab() {
  return (
    <div className="flex flex-col gap-8">
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
      {/* Page content */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        {active === 'dashboard' && <DashboardTab />}
        {active === 'workout'   && <WorkoutStub />}
        {active === 'diet'      && <DietTracker />}
        {active === 'profile'   && <ProfileStub />}
      </div>

      {/* Bottom navigation — React-controlled so active state is reactive */}
      <nav
        className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2
                   flex items-center justify-around
                   border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm
                   h-16 z-50"
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
    </>
  );
}
