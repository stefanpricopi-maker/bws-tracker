import { createContext, useContext } from 'react';
import type { PlannedExercise } from '../components/WorkoutPlayer';

export type StartPlayerFn = (exercises: PlannedExercise[], dayType: string) => void;

const WorkoutPlayerContext = createContext<StartPlayerFn | null>(null);

export function WorkoutPlayerProvider({
  startPlayer,
  children,
}: {
  startPlayer: StartPlayerFn;
  children: React.ReactNode;
}) {
  return (
    <WorkoutPlayerContext.Provider value={startPlayer}>
      {children}
    </WorkoutPlayerContext.Provider>
  );
}

export function useStartWorkoutPlayer(): StartPlayerFn {
  const fn = useContext(WorkoutPlayerContext);
  if (!fn) {
    throw new Error('useStartWorkoutPlayer must be used within WorkoutPlayerProvider');
  }
  return fn;
}

/** Optional hook when prop fallback is still used in tests. */
export function useStartWorkoutPlayerOptional(): StartPlayerFn | null {
  return useContext(WorkoutPlayerContext);
}
