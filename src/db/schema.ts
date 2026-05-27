import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export const dailyLogs = sqliteTable('daily_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // ISO 8601 date string: YYYY-MM-DD
  weightKg: real('weight_kg'),
  steps: integer('steps'),
  caloriesIn: integer('calories_in'),
  proteinG: real('protein_g'),
  carbsG: real('carbs_g'),
  fatG: real('fat_g'),
});

export const workouts = sqliteTable('workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // ISO 8601 date string: YYYY-MM-DD
  dayType: text('day_type').notNull(), // e.g. 'Push', 'Pull', 'Legs', 'Rest'
});

export const workoutSets = sqliteTable('workout_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutId: integer('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseName: text('exercise_name').notNull(),
  weight: real('weight').notNull(),
  reps: integer('reps').notNull(),
  setNumber: integer('set_number').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type DailyLog = typeof dailyLogs.$inferSelect;
export type NewDailyLog = typeof dailyLogs.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;

export const userGoals = sqliteTable('user_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  targetWeightKg: real('target_weight_kg'),
  weeklyWeightLossKg: real('weekly_weight_loss_kg').default(0.5),
  tdeeKcal: integer('tdee_kcal'),
  targetCaloriesKcal: integer('target_calories_kcal').default(1850),
  targetProteinG: integer('target_protein_g').default(180),
  targetCarbsG: integer('target_carbs_g').default(113),
  targetFatG: integer('target_fat_g').default(75),
  targetSteps: integer('target_steps').default(10000),
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type UserGoals = typeof userGoals.$inferSelect;
export type NewUserGoals = typeof userGoals.$inferInsert;
