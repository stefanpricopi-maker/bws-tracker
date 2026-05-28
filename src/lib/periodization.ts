// ─────────────────────────────────────────────────────────────────────────────
// Periodization — Mesocycle block management & exercise swap map.
//
// Block 1: Compound-heavy, bilateral, free-weight dominant.
// Block 2: Unilateral / machine / cable variants — same muscle groups,
//          different motor patterns → prevents adaptive resistance + joint wear.
// ─────────────────────────────────────────────────────────────────────────────

export const MESOCYCLE_WEEKS = 8;

/**
 * Block 1 → Block 2 exercise substitution map.
 * Keyed by the Block 1 exercise name. Value is the Block 2 substitute.
 *
 * Swap rationale per entry (shown in UI tooltip):
 */
export const EXERCISE_SWAP: Record<string, { block2: string; rationale: string }> = {
  // ── Push ──────────────────────────────────────────────────────────────────
  'Bench Press': {
    block2: 'Incline Barbell Press',
    rationale: 'Shifts load to upper chest; new angle breaks flat-press adaptation.',
  },
  'Overhead Press': {
    block2: 'Arnold Press',
    rationale: 'Rotation through the press recruits more anterior and medial delt fibers.',
  },
  'Incline Dumbbell Press': {
    block2: 'Cable Chest Press',
    rationale: 'Constant cable tension keeps pecs under load through full ROM.',
  },
  'Lateral Raises': {
    block2: 'Cable Lateral Raises',
    rationale: 'Cable keeps resistance consistent at the bottom — no free-weight dead zone.',
  },
  'Tricep Pushdowns': {
    block2: 'Tricep Dips',
    rationale: 'Bodyweight compound; adds stretch at the top that cable misses.',
  },
  'Overhead Tricep Extensions': {
    block2: 'Skull Crushers',
    rationale: 'Longer lever at full extension → greater long-head stretch stimulus.',
  },

  // ── Pull ──────────────────────────────────────────────────────────────────
  'Barbell Row': {
    block2: 'Chest-Supported Dumbbell Row',
    rationale: 'Chest support removes lower-back from the equation; pure lat/rhomboid work.',
  },
  'Pull-Ups': {
    block2: 'Lat Pulldown',
    rationale: 'Adjustable load allows progressive overload past bodyweight plateau.',
  },
  'Seated Cable Row': {
    block2: 'T-Bar Row',
    rationale: 'Neutral grip + plate loading shifts emphasis to mid-back thickness.',
  },
  'Face Pulls': {
    block2: 'Rear Delt Fly',
    rationale: 'Dumbbell fly hits posterior delt in abduction; complements internal rotation from face pulls.',
  },
  'Barbell Curl': {
    block2: 'EZ-Bar Curl',
    rationale: 'Slight supination angle reduces wrist strain accumulated over Block 1.',
  },
  'Hammer Curl': {
    block2: 'Incline Dumbbell Curl',
    rationale: 'Incline position stretches long head of bicep — greatest hypertrophy stimulus.',
  },

  // ── Legs ──────────────────────────────────────────────────────────────────
  'Barbell Squat': {
    block2: 'Hack Squat',
    rationale: 'Machine removes spinal load; maintains quad stimulus with zero lower-back fatigue.',
  },
  'Romanian Deadlift': {
    block2: 'Nordic Curl',
    rationale: 'Eccentric-dominant; targets hamstring lengthening that RDL misses.',
  },
  'Leg Press': {
    block2: 'Bulgarian Split Squat',
    rationale: 'Unilateral loading corrects bilateral leg strength imbalances built in Block 1.',
  },
  'Leg Curl': {
    block2: 'Stiff-Leg Deadlift',
    rationale: 'Hip-hinge pattern hits hamstrings from hip; leg curl only covers knee flexion.',
  },
  'Calf Raises': {
    block2: 'Donkey Calf Raises',
    rationale: 'Hip-flexed position pre-stretches gastrocnemius for deeper ROM.',
  },

  // ── Upper ─────────────────────────────────────────────────────────────────
  'Incline Bench Press': {
    block2: 'Flat Dumbbell Press',
    rationale: 'Dumbbell freedom of movement prevents the groove compensation built with barbell.',
  },
  'Incline Dumbbell Curl': {
    block2: 'Preacher Curl',
    rationale: 'Arm-braced position eliminates shoulder swing; strict bicep isolation.',
  },
  'Cable Fly': {
    block2: 'Dumbbell Fly',
    rationale: 'Greater stretch at bottom position; higher peak tension through pec.',
  },
  'Tricep Dips': {
    block2: 'Close-Grip Bench Press',
    rationale: 'Barbell adds easy progressive overload; safer on shoulder joint long-term.',
  },
  'Concentration Curl': {
    block2: 'Drag Curl',
    rationale: 'Elbow travels behind torso — targets brachialis and long head differently.',
  },

  // ── Legs + Arms ───────────────────────────────────────────────────────────
  'Front Squat': {
    block2: 'Goblet Squat',
    rationale: 'Dumbbell goblet removes wrist strain from front rack; same upright torso benefit.',
  },
  'Crossbody Hammer Curl': {
    block2: 'Reverse Curl',
    rationale: 'Overhand grip shifts load to brachialis and brachioradialis for forearm balance.',
  },
  'Leg Extension': {
    block2: 'Step-Ups',
    rationale: 'Functional unilateral pattern; avoids patellar compression from machine.',
  },
  'Preacher Curl': {
    block2: 'Spider Curl',
    rationale: 'Prone position keeps arm vertical — maximum peak contraction stimulus.',
  },
  'Seated Calf Raise': {
    block2: 'Standing Calf Raise',
    rationale: 'Straight-knee position emphasises gastrocnemius over soleus.',
  },
};

/**
 * Returns the exercise name for the given block number.
 * Block 1 → original name.
 * Block 2 → swapped name (or original if no swap defined).
 */
export function getExerciseForBlock(name: string, block: number): string {
  if (block === 1) return name;
  return EXERCISE_SWAP[name]?.block2 ?? name;
}

/**
 * Returns weeks elapsed since blockStartDate (ISO string).
 */
export function weeksElapsed(blockStartDate: string): number {
  const start = new Date(blockStartDate).getTime();
  const now   = Date.now();
  return Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Returns true when the current mesocycle is complete (>= MESOCYCLE_WEEKS).
 */
export function isMesocycleComplete(blockStartDate: string): boolean {
  return weeksElapsed(blockStartDate) >= MESOCYCLE_WEEKS;
}

/**
 * Returns the next block number (1 → 2 → 1 cycling).
 */
export function nextBlock(current: number): number {
  return current === 1 ? 2 : 1;
}
