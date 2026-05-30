import { useCallback, useEffect, useState } from 'react';
import type { BendSession } from './types';
import type { BendRoutineTemplate } from './routines';
import {
  addPoseToSession,
  createBendSessionFromPoses,
  createBendSessionFromRoutine,
  fetchBendSessionByDate,
  markSessionCompleted,
  saveBendSession,
  setSessionNotes,
  todayDateString,
  togglePoseCompleted,
  updatePoseInSession,
} from './bendService';

interface UseBendSessionOptions {
  date?: string;
}

export function useBendSession(options: UseBendSessionOptions = {}) {
  const date = options.date ?? todayDateString();
  const [session, setSession] = useState<BendSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const existing = await fetchBendSessionByDate(date);
      setSession(existing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (next: BendSession) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveBendSession(next);
      setSession(saved);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const startFromRoutine = useCallback(async (routine: BendRoutineTemplate) => {
    const next = createBendSessionFromRoutine(routine, date);
    await persist(next);
  }, [date, persist]);

  const startCustom = useCallback(async (
    routineName: string,
    poses: Array<{ poseName: string; targetDurationSeconds: number }>,
  ) => {
    const next = createBendSessionFromPoses(routineName, poses, date);
    await persist(next);
  }, [date, persist]);

  const addPose = useCallback(async (poseName: string, targetDurationSeconds: number) => {
    if (!session) return;
    await persist(addPoseToSession(session, poseName, targetDurationSeconds));
  }, [session, persist]);

  const updatePose = useCallback(async (
    poseIndex: number,
    patch: { actualDurationSeconds?: number; completed?: boolean },
  ) => {
    if (!session) return;
    await persist(updatePoseInSession(session, poseIndex, patch));
  }, [session, persist]);

  const togglePose = useCallback(async (poseIndex: number) => {
    if (!session) return;
    await persist(togglePoseCompleted(session, poseIndex));
  }, [session, persist]);

  const completeSession = useCallback(async () => {
    if (!session) return;
    await persist(markSessionCompleted(session, true));
  }, [session, persist]);

  const updateNotes = useCallback(async (notes: string) => {
    if (!session) return;
    await persist(setSessionNotes(session, notes));
  }, [session, persist]);

  return {
    session,
    loading,
    saving,
    error,
    reload: load,
    startFromRoutine,
    startCustom,
    addPose,
    updatePose,
    togglePose,
    completeSession,
    updateNotes,
  };
}
