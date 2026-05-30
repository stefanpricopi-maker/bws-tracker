import { deloadSetCount } from './periodization';

export const WEEKLY_SCHEDULE = [
  { day_name: 'Monday',    category: 'Push',       isRest: false },
  { day_name: 'Tuesday',   category: 'Pull',       isRest: false },
  { day_name: 'Wednesday', category: 'Rest',       isRest: true },
  { day_name: 'Thursday',  category: 'Legs',       isRest: false },
  { day_name: 'Friday',    category: 'Upper',      isRest: false },
  { day_name: 'Saturday',  category: 'Legs+Arms',  isRest: false },
  { day_name: 'Sunday',    category: 'Rest',       isRest: true },
] as const;

export interface WeeklyPlanExercise {
  name: string;
  sets: number;
}

export interface WeeklyPlanDay {
  day_name: string;
  category: string;
  exercises: WeeklyPlanExercise[];
}

export interface WeeklyPlan {
  split_type: '7-day';
  days: WeeklyPlanDay[];
  isDeloadWeek?: boolean;
}

function sanitizeExercises(
  exercises: WeeklyPlanExercise[] | undefined,
  validNames: Set<string>,
  isDeload: boolean,
): WeeklyPlanExercise[] {
  if (!Array.isArray(exercises)) return [];
  return exercises
    .filter((ex) => {
      if (typeof ex !== 'object' || ex === null) return false;
      if (!validNames.has(ex.name)) return false;
      return true;
    })
    .map((ex) => {
      let sets = Math.min(5, Math.max(2, Math.round(Number(ex.sets) || 3)));
      if (isDeload) sets = deloadSetCount(sets);
      return { name: ex.name, sets };
    });
}

/** Normalize LLM output to a fixed Mon–Sun calendar with Wed/Sun rest. */
export function normalizeWeeklyPlan(
  raw: { days?: WeeklyPlanDay[] },
  validNames: Set<string>,
  isDeload: boolean,
): WeeklyPlan {
  const llmDays = raw.days ?? [];
  const byDayName = new Map<string, WeeklyPlanDay>();
  const byCategory = new Map<string, WeeklyPlanDay>();

  for (const day of llmDays) {
    byDayName.set(day.day_name.trim().toLowerCase(), day);
    if (day.category !== 'Rest' && Array.isArray(day.exercises) && day.exercises.length > 0) {
      if (!byCategory.has(day.category)) byCategory.set(day.category, day);
    }
  }

  const days = WEEKLY_SCHEDULE.map(({ day_name, category, isRest }) => {
    if (isRest) {
      return { day_name, category: 'Rest', exercises: [] as WeeklyPlanExercise[] };
    }

    const byName = byDayName.get(day_name.toLowerCase());
    let source = byName?.exercises?.length ? byName : undefined;
    if (!source) source = byCategory.get(category);
    if (!source && category === 'Legs+Arms') source = byCategory.get('Legs');

    return {
      day_name,
      category,
      exercises: sanitizeExercises(source?.exercises, validNames, isDeload),
    };
  });

  return { split_type: '7-day', days, isDeloadWeek: isDeload };
}
