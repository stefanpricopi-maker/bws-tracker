/**
 * Seed script — populates bws.db with a demo user and 30 days of weight data.
 * Run with:  npx tsx src/scripts/seed.ts
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { users, dailyLogs } from '../db/schema';
import { eq } from 'drizzle-orm';

const sqlite = new Database('./bws.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite);

// ── Upsert demo user ───────────────────────────────────────────────────────
let user = db.select().from(users).where(eq(users.id, 1)).get();
if (!user) {
  db.insert(users).values({ name: 'Demo User' }).run();
  user = db.select().from(users).where(eq(users.id, 1)).get()!;
}

console.log(`Using user: ${user.name} (id=${user.id})`);

// ── Generate 30 days of realistic weight entries ───────────────────────────
// Simulate a slow ~0.3 kg/week cut from 88 kg with natural daily variance
const START_WEIGHT = 88.0;
const DAILY_TREND  = -(0.3 / 7); // kg per day

const today = new Date();

const entries = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() - (29 - i));
  const date = d.toISOString().slice(0, 10);

  const trend   = START_WEIGHT + DAILY_TREND * i;
  const noise   = (Math.random() - 0.5) * 0.8; // ±0.4 kg natural variance
  const weight  = Math.round((trend + noise) * 10) / 10;

  const calories = 2000 + Math.round((Math.random() - 0.5) * 300);
  const protein  = 155  + Math.round((Math.random() - 0.5) * 20);
  const carbs    = 180  + Math.round((Math.random() - 0.5) * 40);
  const fat      = 60   + Math.round((Math.random() - 0.5) * 10);
  const steps    = 8000 + Math.round((Math.random() - 0.5) * 4000);

  return { userId: user!.id, date, weightKg: weight, caloriesIn: calories, proteinG: protein, carbsG: carbs, fatG: fat, steps };
});

// Clear existing demo data for user 1 then re-insert
db.delete(dailyLogs).where(eq(dailyLogs.userId, user.id)).run();
db.insert(dailyLogs).values(entries).run();

console.log(`Seeded ${entries.length} daily log entries.`);
console.log(`Weight range: ${Math.min(...entries.map(e => e.weightKg))} – ${Math.max(...entries.map(e => e.weightKg))} kg`);
sqlite.close();
