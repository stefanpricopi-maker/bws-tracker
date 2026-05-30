/** Link imported Google Fit sessions to workout rows via dayType prefix. */

export function googleFitDayType(sessionId: string, activityLabel: string): string {
  return `[gfit:${sessionId}] Cardio · ${activityLabel}`;
}

export function parseGoogleFitSessionId(dayType: string): string | null {
  const match = dayType.match(/^\[gfit:([^\]]+)\]/);
  return match?.[1] ?? null;
}

export function displayDayType(dayType: string): string {
  return dayType.replace(/^\[gfit:[^\]]+\]\s*/, '');
}
