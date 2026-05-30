import { describe, it, expect } from 'vitest';
import { BEND_ROUTINES } from './routines';
import {
  addPoseToSession,
  createBendSessionFromRoutine,
  markSessionCompleted,
  recomputeSessionCompletion,
  sessionProgress,
  togglePoseCompleted,
  updatePoseInSession,
} from './bendService';

describe('bendService', () => {
  it('creates a session from routine with timestamp and poses', () => {
    const routine = BEND_ROUTINES[0];
    const session = createBendSessionFromRoutine(routine, '2026-05-30', 1_700_000_000_000);
    expect(session.date).toBe('2026-05-30');
    expect(session.timestamp).toBe(1_700_000_000_000);
    expect(session.routineName).toBe(routine.name);
    expect(session.poses).toHaveLength(routine.poses.length);
    expect(session.poses.every((p) => p.completed === false)).toBe(true);
    expect(session.completed).toBe(false);
  });

  it('updates pose duration and completion', () => {
    const session = createBendSessionFromRoutine(BEND_ROUTINES[0]);
    const updated = updatePoseInSession(session, 0, {
      actualDurationSeconds: 55,
      completed: true,
    });
    expect(updated.poses[0].actualDurationSeconds).toBe(55);
    expect(updated.poses[0].completed).toBe(true);
    expect(updated.completed).toBe(false);
  });

  it('marks session complete when all poses done', () => {
    let session = createBendSessionFromRoutine(BEND_ROUTINES[0]);
    for (let i = 0; i < session.poses.length; i++) {
      session = togglePoseCompleted(session, i);
    }
    session = recomputeSessionCompletion(session);
    expect(session.completed).toBe(true);
    expect(sessionProgress(session).done).toBe(session.poses.length);
  });

  it('adds custom pose to session', () => {
    const session = addPoseToSession(
      createBendSessionFromRoutine(BEND_ROUTINES[0]),
      'Neck Rolls',
      30,
    );
    expect(session.poses.at(-1)?.poseName).toBe('Neck Rolls');
  });

  it('markSessionCompleted sets all poses done', () => {
    const session = markSessionCompleted(createBendSessionFromRoutine(BEND_ROUTINES[0]));
    expect(session.completed).toBe(true);
    expect(session.poses.every((p) => p.completed)).toBe(true);
  });
});
