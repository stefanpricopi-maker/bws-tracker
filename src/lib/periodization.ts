// ─────────────────────────────────────────────────────────────────────────────
// Periodization — Mesocycle block management & exercise swap map.
//
// Block 1: Compound-heavy, bilateral, free-weight dominant.
// Block 2: Unilateral / machine / cable variants — same muscle groups,
//          different motor patterns → prevents adaptive resistance + joint wear.
// ─────────────────────────────────────────────────────────────────────────────

/** Weeks of progressive work before the scheduled deload week. */
export const MESOCYCLE_WORK_WEEKS = 7;

/** Total weeks per block (includes 1 deload week at the end). */
export const MESOCYCLE_WEEKS = 8;

/**
 * Block 1 → Block 2 exercise substitution map (Home-Gym: Dumbbells & Bands).
 * Same muscle groups, different mechanics → breaks adaptation without changing equipment.
 */
export const EXERCISE_SWAP: Record<string, { block2: string; rationale: string }> = {
  // ── Push ──────────────────────────────────────────────────────────────────
  'Dumbbell Floor Press': {
    block2: 'Deficit Push-ups',
    rationale: 'Bodyweight + deficit increases pec stretch; trains end-range strength missing in floor press.',
  },
  'Dumbbell Overhead Press': {
    block2: 'Banded Lateral Raises',
    rationale: 'Band provides ascending resistance curve — maximum tension at peak contraction.',
  },
  'Deficit Push-ups': {
    block2: 'Banded Chest Flyes',
    rationale: 'Isolation fly adds adduction component; hits sternal head that push-up misses.',
  },
  'Banded Chest Flyes': {
    block2: 'Deficit Push-ups',
    rationale: 'Compound movement re-integrates tricep and shoulder into the push pattern.',
  },
  'Dumbbell Lateral Raises': {
    block2: 'Banded Lateral Raises',
    rationale: 'Band keeps medial delt under tension at the bottom — eliminates free-weight dead zone.',
  },
  'Banded Triceps Pushdowns': {
    block2: 'Dumbbell Floor Skullcrushers',
    rationale: 'Heavier loaded eccentric targets long-head stretch that band pushdowns cannot achieve.',
  },
  'Dumbbell Floor Skullcrushers': {
    block2: 'Banded Triceps Pushdowns',
    rationale: 'High-rep band work pumps blood into the tricep; active recovery from heavy loading.',
  },

  // ── Pull ──────────────────────────────────────────────────────────────────
  'Dumbbell Bent-Over Row': {
    block2: 'Single-Arm Dumbbell Row',
    rationale: 'Unilateral loading corrects left/right strength asymmetry built in bilateral Block 1.',
  },
  'Single-Arm Dumbbell Row': {
    block2: 'Dumbbell Bent-Over Row',
    rationale: 'Bilateral pattern allows heavier loading for lat thickness overload.',
  },
  'Banded Lat Pulldown': {
    block2: 'Dumbbell Pullover',
    rationale: 'Pullover trains lat in full stretch under load — different torque curve to pulldown.',
  },
  'Dumbbell Pullover': {
    block2: 'Banded Lat Pulldown',
    rationale: 'Vertical pull pattern re-trains lat shortening; complements pullover stretch stimulus.',
  },
  'Banded Face Pulls': {
    block2: 'Dumbbell Reverse Flyes',
    rationale: 'Dumbbell fly hits posterior delt in pure abduction; pairs with rotator work from face pulls.',
  },
  'Dumbbell Reverse Flyes': {
    block2: 'Banded Face Pulls',
    rationale: 'External rotation component of face pulls targets infraspinatus for shoulder health.',
  },
  'Dumbbell Biceps Curl': {
    block2: 'Banded Hammer Curl',
    rationale: 'Neutral grip band curl targets brachialis and brachioradialis for arm thickness.',
  },
  'Banded Hammer Curl': {
    block2: 'Dumbbell Biceps Curl',
    rationale: 'Supinated dumbbell curl maximises bicep peak contraction and forearm supination.',
  },

  // ── Legs ──────────────────────────────────────────────────────────────────
  'Bulgarian Split Squats': {
    block2: 'Single-Leg RDLs',
    rationale: 'Shifts from quad-dominant to posterior chain — hip hinge pattern balances split squat adaptation.',
  },
  'Dumbbell Goblet Squats': {
    block2: 'Bulgarian Split Squats',
    rationale: 'Greater unilateral demand and ROM; breaks the bilateral symmetry pattern.',
  },
  'Dumbbell Romanian Deadlifts': {
    block2: 'Single-Leg RDLs',
    rationale: 'Unilateral RDL adds balance demand and corrects inter-limb hamstring asymmetry.',
  },
  'Single-Leg RDLs': {
    block2: 'Dumbbell Romanian Deadlifts',
    rationale: 'Bilateral RDL allows heavier loading for hamstring strength overload.',
  },
  'Banded Lying Leg Curls': {
    block2: 'Dumbbell Romanian Deadlifts',
    rationale: 'Hip-hinge lengthened-position hamstring work — greater growth stimulus than knee-flexion alone.',
  },
  'Single-Leg Calf Raises': {
    block2: 'Dumbbell Goblet Squats',
    rationale: 'Adds quad volume; calves already receive indirect work from split squat variants.',
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
 * Week index 7 (displayed as week 8): planned deload — lower volume, ~12% lighter loads.
 */
export function isDeloadWeek(weeksElapsed: number): boolean {
  return weeksElapsed >= MESOCYCLE_WORK_WEEKS && weeksElapsed < MESOCYCLE_WEEKS;
}

/** Keep 60% of working sets during mesocycle deload week (~40% volume cut). */
export const DELOAD_VOLUME_FACTOR = 0.6;

/**
 * Set count for a deload week (min 1). Example: 3 → 2, 4 → 2.
 */
export function deloadSetCount(sets: number): number {
  if (sets <= 1) return 1;
  return Math.max(1, Math.round(sets * DELOAD_VOLUME_FACTOR));
}

/**
 * Returns true when the current mesocycle is complete (after deload week).
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
