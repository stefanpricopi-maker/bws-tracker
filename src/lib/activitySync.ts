/** Session cache for today's Google Fit activity (shared Home ↔ Diet). */

const CACHE_KEY = 'bws_activity_today';

export interface ActivitySyncData {
  date:           string;
  activeCalories: number;
  steps:          number;
}

export function cacheActivitySync(data: ActivitySyncData): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

export function readCachedActivitySync(today: string): ActivitySyncData | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivitySyncData;
    if (parsed.date !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}
