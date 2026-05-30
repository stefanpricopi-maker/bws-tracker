export interface BendRoutineTemplate {
  id: string;
  name: string;
  description: string;
  poses: Array<{ poseName: string; targetDurationSeconds: number }>;
}

export const BEND_ROUTINES: BendRoutineTemplate[] = [
  {
    id: 'morning-mobility',
    name: 'Morning Mobility Routine',
    description: 'Wake-up flow for hips, spine, and shoulders before the day.',
    poses: [
      { poseName: 'Cat-Cow', targetDurationSeconds: 60 },
      { poseName: "Child's Pose", targetDurationSeconds: 45 },
      { poseName: 'World\'s Greatest Stretch', targetDurationSeconds: 45 },
      { poseName: 'Couch Stretch', targetDurationSeconds: 60 },
      { poseName: 'Thoracic Rotation', targetDurationSeconds: 45 },
    ],
  },
  {
    id: 'morning-posture',
    name: 'Morning Posture Focus',
    description: 'Desk-worker reset: chest, hip flexors, and upper back.',
    poses: [
      { poseName: 'Chest Doorway Stretch', targetDurationSeconds: 45 },
      { poseName: 'Hip Flexor Lunge', targetDurationSeconds: 60 },
      { poseName: 'Seated Thoracic Extension', targetDurationSeconds: 45 },
      { poseName: 'Neck Retraction Hold', targetDurationSeconds: 30 },
      { poseName: 'Wrist Flexor Stretch', targetDurationSeconds: 30 },
    ],
  },
  {
    id: 'evening-unwind',
    name: 'Evening Unwind',
    description: 'Low-intensity release before sleep.',
    poses: [
      { poseName: 'Supine Figure-4', targetDurationSeconds: 60 },
      { poseName: 'Happy Baby', targetDurationSeconds: 45 },
      { poseName: 'Legs Up the Wall', targetDurationSeconds: 90 },
      { poseName: 'Supine Spinal Twist', targetDurationSeconds: 45 },
    ],
  },
];

export function findRoutine(id: string): BendRoutineTemplate | undefined {
  return BEND_ROUTINES.find((r) => r.id === id);
}
