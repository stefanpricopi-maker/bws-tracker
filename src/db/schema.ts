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
  photoUrl: text('photo_url'),
  mealsJson: text('meals_json'),
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
  rpe: real('rpe'),
});

export const blockHistory = sqliteTable('block_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  block: integer('block').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type DailyLog = typeof dailyLogs.$inferSelect;
export type NewDailyLog = typeof dailyLogs.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;

export type BlockHistory = typeof blockHistory.$inferSelect;
export type NewBlockHistory = typeof blockHistory.$inferInsert;

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

export const googleTokens = sqliteTable('google_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiryDate: integer('expiry_date'), // Unix ms timestamp
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type GoogleTokens = typeof googleTokens.$inferSelect;
export type NewGoogleTokens = typeof googleTokens.$inferInsert;

export const mesocycles = sqliteTable('mesocycles', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  userId:         integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  currentBlock:   integer('current_block').notNull().default(1),
  blockStartDate: text('block_start_date').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt:      text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type Mesocycle = typeof mesocycles.$inferSelect;
export type NewMesocycle = typeof mesocycles.$inferInsert;

export const exercises = sqliteTable('exercises', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  name:         text('name').notNull().unique(),
  targetMuscle: text('target_muscle').notNull(),
  category:     text('category').notNull(), // 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Full Body'
  imageUrl:     text('image_url'),           // GIF or image link for form-guide display
  isCustom:     integer('is_custom',   { mode: 'boolean' }).notNull().default(false),
  isArchived:   integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt:    text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type Exercise    = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
