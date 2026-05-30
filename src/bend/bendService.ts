import type { BendSession, DailyActivityTracker, StretchPoseLog } from './types';
import type { BendRoutineTemplate } from './routines';

export function todayDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `bend-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function posesFromTemplate(
  poses: Array<{ poseName: string; targetDurationSeconds: number }>,
): StretchPoseLog[] {
  return poses.map((p) => ({
    poseName: p.poseName,
    targetDurationSeconds: p.targetDurationSeconds,
    completed: false,
  }));
}

export function createBendSessionFromRoutine(
  routine: BendRoutineTemplate,
  date = todayDateString(),
  now = Date.now(),
): BendSession {
  return {
    id: newSessionId(),
    date,
    timestamp: now,
    routineName: routine.name,
    poses: posesFromTemplate(routine.poses),
    completed: false,
  };
}

export function createBendSessionFromPoses(
  routineName: string,
  poses: Array<{ poseName: string; targetDurationSeconds: number }>,
  date = todayDateString(),
  now = Date.now(),
): BendSession {
  return {
    id: newSessionId(),
    date,
    timestamp: now,
    routineName,
    poses: posesFromTemplate(poses),
    completed: false,
  };
}

export function addPoseToSession(
  session: BendSession,
  poseName: string,
  targetDurationSeconds: number,
): BendSession {
  const name = poseName.trim();
  if (!name) return session;
  return {
    ...session,
    completed: false,
    poses: [
      ...session.poses,
      { poseName: name, targetDurationSeconds, completed: false },
    ],
  };
}

export function updatePoseInSession(
  session: BendSession,
  poseIndex: number,
  patch: Partial<Pick<StretchPoseLog, 'actualDurationSeconds' | 'completed'>>,
): BendSession {
  if (poseIndex < 0 || poseIndex >= session.poses.length) return session;
  const poses = session.poses.map((pose, i) =>
    i === poseIndex ? { ...pose, ...patch } : pose,
  );
  return recomputeSessionCompletion({ ...session, poses });
}

export function togglePoseCompleted(session: BendSession, poseIndex: number): BendSession {
  const pose = session.poses[poseIndex];
  if (!pose) return session;
  return updatePoseInSession(session, poseIndex, { completed: !pose.completed });
}

export function setSessionNotes(session: BendSession, notes: string): BendSession {
  return { ...session, notes: notes.trim() || undefined };
}

export function markSessionCompleted(session: BendSession, completed = true): BendSession {
  return {
    ...session,
    completed,
    poses: completed
      ? session.poses.map((p) => ({ ...p, completed: true }))
      : session.poses,
  };
}

export function recomputeSessionCompletion(session: BendSession): BendSession {
  const allDone = session.poses.length > 0 && session.poses.every((p) => p.completed);
  return { ...session, completed: allDone };
}

export function sessionProgress(session: BendSession): { done: number; total: number } {
  const total = session.poses.length;
  const done = session.poses.filter((p) => p.completed).length;
  return { done, total };
}

export function toDailyActivity(session: BendSession): DailyActivityTracker {
  return { date: session.date, bendSession: session };
}

export async function fetchBendSessionByDate(date: string): Promise<BendSession | null> {
  const res = await fetch(`/api/bend-sessions?date=${encodeURIComponent(date)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Nu am putut încărca sesiunea Bend');
  }
  const data = await res.json() as { session: BendSession | null };
  return data.session ?? null;
}

export async function fetchBendSessionById(id: string): Promise<BendSession | null> {
  const res = await fetch(`/api/bend-sessions?id=${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load Bend session');
  const data = await res.json() as { session: BendSession | null };
  return data.session ?? null;
}

export async function saveBendSession(session: BendSession): Promise<BendSession> {
  const res = await fetch('/api/bend-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Failed to save Bend session');
  }
  const data = await res.json() as { session: BendSession };
  return data.session;
}

export async function deleteBendSession(id: string): Promise<void> {
  const res = await fetch(`/api/bend-sessions?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error('Failed to delete Bend session');
  }
}
