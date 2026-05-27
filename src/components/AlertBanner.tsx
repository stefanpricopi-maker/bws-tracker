import { useState, useEffect } from 'react';

interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
}

function todayKey(): string {
  const d = new Date().toISOString().slice(0, 10);
  return `dismissed_alerts_${d}`;
}

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>): void {
  try {
    localStorage.setItem(todayKey(), JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

const BORDER: Record<Alert['type'], string> = {
  warning: 'border-amber-500',
  danger: 'border-red-500',
  info: 'border-blue-500',
};

const ICON: Record<Alert['type'], string> = {
  warning: '⚠️',
  danger: '🚨',
  info: 'ℹ️',
};

export default function AlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(getDismissed());
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((data: { alerts: Alert[] }) => setAlerts(data.alerts ?? []))
      .catch(() => {});
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`bg-gray-800/80 border-l-4 ${BORDER[alert.type]} rounded-xl p-3 flex items-start gap-3`}
        >
          <span className="text-lg leading-none mt-0.5 flex-shrink-0">{ICON[alert.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{alert.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{alert.message}</p>
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            aria-label="Dismiss"
            className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors text-base leading-none bg-transparent border-0 cursor-pointer p-0.5"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
