import { useEffect, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const WeightIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const WorkoutIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4v16M18 4v16M3 8h3m12 0h3M3 16h3m12 0h3" />
  </svg>
);

const LogIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: <HomeIcon /> },
  { href: '/weight', label: 'Weight', icon: <WeightIcon /> },
  { href: '/workouts', label: 'Workouts', icon: <WorkoutIcon /> },
  { href: '/log', label: 'Log', icon: <LogIcon /> },
];

export default function BottomNav() {
  const [activePath, setActivePath] = useState('/');

  useEffect(() => {
    setActivePath(window.location.pathname);
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16 border-t safe-area-inset-bottom"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/'
            ? activePath === '/'
            : activePath.startsWith(item.href);

        return (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 px-4 py-1 transition-colors duration-150"
            style={{
              color: isActive ? 'var(--color-accent-light)' : 'var(--color-muted)',
            }}
            aria-label={item.label}
          >
            {item.icon}
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
