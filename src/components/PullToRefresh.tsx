import { useRef, useState, type ReactNode } from 'react';

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pull, setPull]       = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY                = useRef(0);
  const pulling                 = useRef(false);

  async function triggerRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 8 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pulling.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy * 0.45, 100));
    else setPull(0);
  }

  function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull >= THRESHOLD) void triggerRefresh();
    else setPull(0);
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pull > 0 || refreshing ? Math.max(pull, refreshing ? 40 : 0) : 0 }}
      >
        <span className="text-xs text-gray-500 font-medium">
          {refreshing ? 'Refreshing…' : pull >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
      {children}
    </div>
  );
}
