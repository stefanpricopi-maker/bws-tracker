import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../../src/db/schema';

/**
 * Creates an isolated in-memory LibSQL + Drizzle instance for each test.
 * Call setupTestDb() in beforeEach and use the returned `db`.
 */
export function setupTestDb() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema });
  return { db, client };
}

/**
 * Initialises the schema tables. Must be awaited before any inserts.
 * Mirrors the production Drizzle schema DDL.
 */
export async function initSchema(client: ReturnType<typeof createClient>) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date        TEXT    NOT NULL,
      weight_kg   REAL,
      steps       INTEGER,
      calories_in INTEGER,
      protein_g   REAL,
      carbs_g     REAL,
      fat_g       REAL,
      photo_url   TEXT,
      meals_json  TEXT
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date     TEXT    NOT NULL,
      day_type TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id    INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_name TEXT    NOT NULL,
      weight        REAL    NOT NULL,
      reps          INTEGER NOT NULL,
      set_number    INTEGER NOT NULL,
      rpe           REAL
    );

    CREATE TABLE IF NOT EXISTS mesocycles (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      current_block    INTEGER NOT NULL DEFAULT 1,
      block_start_date TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS block_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      block      INTEGER NOT NULL,
      started_at TEXT    NOT NULL,
      ended_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS user_goals (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      target_weight_kg      REAL,
      weekly_weight_loss_kg REAL    DEFAULT 0.5,
      tdee_kcal             INTEGER,
      target_calories_kcal  INTEGER DEFAULT 1850,
      target_protein_g      INTEGER DEFAULT 180,
      target_carbs_g        INTEGER DEFAULT 113,
      target_fat_g          INTEGER DEFAULT 75,
      target_steps          INTEGER DEFAULT 10000,
      updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS google_tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      access_token  TEXT    NOT NULL,
      refresh_token TEXT,
      expiry_date   INTEGER,
      updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL UNIQUE,
      target_muscle TEXT    NOT NULL,
      category      TEXT    NOT NULL,
      image_url     TEXT,
      is_custom     INTEGER NOT NULL DEFAULT 0,
      is_archived   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
}

/** Seeds a default user (id=1, name='Stefan') into the test DB. */
export async function seedUser(client: ReturnType<typeof createClient>) {
  await client.execute(`INSERT OR IGNORE INTO users (id, name) VALUES (1, 'Stefan')`);
}
