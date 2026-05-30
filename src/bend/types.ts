// ==========================================
// 1. MODULUL "BEND" (Stretching & Mobilitate)
// ==========================================

export interface StretchPoseLog {
  poseName: string;
  targetDurationSeconds: number;
  actualDurationSeconds?: number;
  completed: boolean;
}

export interface BendSession {
  id: string;
  date: string;
  timestamp: number;
  routineName: string;
  poses: StretchPoseLog[];
  notes?: string;
  completed: boolean;
}

// ==========================================
// 2. MODEL GLOBAL DE ACTIVITATE ZILNICĂ (Integration point)
// ==========================================

export interface DailyActivityTracker {
  date: string;
  bendSession?: BendSession;
}
