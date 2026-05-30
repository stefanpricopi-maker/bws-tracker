import { sql } from 'drizzle-orm';
import { db } from '../db';

let ready = false;

/** Idempotent — safe on Vercel where drizzle migrate is not run at deploy time. */
export async function ensureBendSchema(): Promise<void> {
  if (ready) return;

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS bend_sessions (
      id            TEXT    PRIMARY KEY NOT NULL,
      user_id       INTEGER NOT NULL,
      date          TEXT    NOT NULL,
      timestamp     INTEGER NOT NULL,
      routine_name  TEXT    NOT NULL,
      session_json  TEXT    NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS bend_sessions_user_date_idx
    ON bend_sessions (user_id, date)
  `);

  ready = true;
}

/** Test helper — reset cached flag between tests. */
export function resetBendSchemaCacheForTests(): void {
  ready = false;
}
