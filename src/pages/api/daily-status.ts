import type { APIRoute } from 'astro';
import { db } from '../../db';
import { dailyLogs, workouts, users, userGoals } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

const USER_ID = 1;

const SPLIT_META = [
  { label: 'Day 1 — Push',      dayType: 'Push',      isRest: false },
  { label: 'Day 2 — Pull',      dayType: 'Pull',      isRest: false },
  { label: 'Day 3 — Legs',      dayType: 'Legs',      isRest: false },
  { label: 'Day 4 — Rest',      dayType: 'Rest',      isRest: true  },
  { label: 'Day 5 — Upper',     dayType: 'Upper',     isRest: false },
  { label: 'Day 6 — Legs+Arms', dayType: 'Legs+Arms', isRest: false },
  { label: 'Day 7 — Rest',      dayType: 'Rest',      isRest: true  },
] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function todaySplitIndex() {
  return (new Date().getDay() + 6) % 7;
}

export const GET: APIRoute = async () => {
  const date  = todayStr();
  const split = SPLIT_META[todaySplitIndex()];

  const [[user], [goals], [log], todayWorkouts] = await Promise.all([
    db.select().from(users).where(eq(users.id, USER_ID)).limit(1),
    db.select().from(userGoals).where(eq(userGoals.userId, USER_ID)).limit(1),
    db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, USER_ID), eq(dailyLogs.date, date)))
      .limit(1),
    db.select().from(workouts)
      .where(and(eq(workouts.userId, USER_ID), eq(workouts.date, date))),
  ]);

  const row = log ?? null;
  const weightLogged = row?.weightKg != null;
  const mealsLogged  = (row?.caloriesIn ?? 0) > 0;
  const stepsLogged  = (row?.steps ?? 0) > 0;
  const stepsCount   = row?.steps ?? 0;
  const workoutDone  = todayWorkouts.length > 0;

  const tasks = split.isRest
    ? [
        { id: 'weight',  done: weightLogged },
        { id: 'meals',   done: mealsLogged  },
        { id: 'steps',   done: stepsLogged  },
      ]
    : [
        { id: 'weight',  done: weightLogged },
        { id: 'workout', done: workoutDone  },
        { id: 'meals',   done: mealsLogged  },
        { id: 'steps',   done: stepsLogged  },
      ];

  const completedCount = tasks.filter((t) => t.done).length;

  return new Response(
    JSON.stringify({
      date,
      userName:       user?.name ?? 'Athlete',
      weightLogged,
      mealsLogged,
      stepsLogged,
      stepsCount,
      workoutDone,
      todaySplit: {
        index:   todaySplitIndex(),
        label:   split.label,
        dayType: split.dayType,
        isRest:  split.isRest,
      },
      targetWeightKg: goals?.targetWeightKg ?? null,
      targetSteps:    goals?.targetSteps ?? 10000,
      tasks,
      completedCount,
      totalTasks: tasks.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
