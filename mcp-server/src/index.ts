import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import initSqlJs, { type Database } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../bws.db');

// ── Open database (read-only, loaded into memory via sql.js WASM) ──────────

let db: Database;
try {
  const SQL = await initSqlJs();
  const fileBuffer = readFileSync(DB_PATH);
  db = new SQL.Database(fileBuffer);
} catch (err) {
  process.stderr.write(`Failed to open database at ${DB_PATH}: ${err}\n`);
  process.exit(1);
}

// ── Helper: run a SELECT and return rows as plain objects ──────────────────

type Row = Record<string, string | number | null | Uint8Array>;

function query<T extends Row>(sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject({}) as T);
  }
  stmt.free();
  return rows;
}

// ── Tool: get_fitness_summary ──────────────────────────────────────────────

interface LogRow extends Row {
  date: string;
  weight_kg: number | null;
  steps: number | null;
  calories_in: number | null;
  protein_g: number | null;
}

function getFitnessSummary(days = 14) {
  const rows = query<LogRow>(
    `SELECT date, weight_kg, steps, calories_in, protein_g
     FROM daily_logs
     WHERE user_id = 1
     ORDER BY date DESC
     LIMIT ?`,
    [days],
  );

  // Oldest-first for rolling average
  const chronological = [...rows].reverse();

  return chronological.map((row, i) => {
    const window = chronological
      .slice(Math.max(0, i - 6), i + 1)
      .filter((r) => r.weight_kg != null);
    const avg =
      window.length > 0
        ? Math.round((window.reduce((s, r) => s + r.weight_kg!, 0) / window.length) * 10) / 10
        : null;
    return { ...row, weight_7d_avg: avg };
  });
}

// ── Tool: get_exercise_history ─────────────────────────────────────────────

interface SetRow extends Row {
  date: string;
  set_number: number;
  weight: number;
  reps: number;
}

function getExerciseHistory(exerciseName: string) {
  const rows = query<SetRow>(
    `SELECT w.date, ws.set_number, ws.weight, ws.reps
     FROM workout_sets ws
     JOIN workouts w ON ws.workout_id = w.id
     WHERE ws.exercise_name = ? AND w.user_id = 1
     ORDER BY w.date ASC, ws.set_number ASC`,
    [exerciseName],
  );

  const sessions: Record<string, Array<{ set: number; weight: number; reps: number }>> = {};
  for (const row of rows) {
    if (!sessions[row.date]) sessions[row.date] = [];
    sessions[row.date].push({ set: row.set_number, weight: row.weight, reps: row.reps });
  }

  return Object.entries(sessions).map(([date, sets]) => {
    const topSet = sets.reduce((best, s) => (s.weight > best.weight ? s : best), sets[0]);
    return { date, sets, topSet };
  });
}

// ── Helper: ISO week bounds (Monday–Sunday) ────────────────────────────────

function isoWeekBounds(date: Date): { weekStart: string; weekEnd: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

// ── Tool: get_weekly_summary ───────────────────────────────────────────────

function getWeeklySummary() {
  const now = new Date();
  const { weekStart, weekEnd } = isoWeekBounds(now);

  const prevMonday = new Date(weekStart);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevSunday = new Date(weekEnd);
  prevSunday.setDate(prevSunday.getDate() - 7);
  const prevWeekStart = prevMonday.toISOString().slice(0, 10);
  const prevWeekEnd = prevSunday.toISOString().slice(0, 10);

  interface GoalRow extends Row { target_calories_kcal: number | null; target_protein_g: number | null; target_steps: number | null; }
  const goalRow = query<GoalRow>(
    `SELECT target_calories_kcal, target_protein_g, target_steps FROM user_goals WHERE user_id = 1 LIMIT 1`,
  )[0];
  const targetCalories = goalRow?.target_calories_kcal ?? 1850;
  const targetProtein = goalRow?.target_protein_g ?? 180;

  interface DailyRow extends Row { date: string; weight_kg: number | null; calories_in: number | null; protein_g: number | null; }
  const thisWeekLogs = query<DailyRow>(
    `SELECT date, weight_kg, calories_in, protein_g FROM daily_logs WHERE user_id = 1 AND date >= ? AND date <= ? ORDER BY date DESC`,
    [weekStart, weekEnd],
  );

  // Weight lost
  const weightLogs = thisWeekLogs.filter((l) => l.weight_kg != null);
  let weightLostKg: number | null = null;
  if (weightLogs.length >= 2) {
    const latest = weightLogs[0].weight_kg!;
    const earliest = weightLogs[weightLogs.length - 1].weight_kg!;
    weightLostKg = Math.round((earliest - latest) * 100) / 100;
  } else if (weightLogs.length === 1) {
    const prevLogs = query<DailyRow>(
      `SELECT weight_kg FROM daily_logs WHERE user_id = 1 AND date >= ? AND date <= ? AND weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1`,
      [prevWeekStart, prevWeekEnd],
    );
    if (prevLogs.length > 0) {
      weightLostKg = Math.round((prevLogs[0].weight_kg! - weightLogs[0].weight_kg!) * 100) / 100;
    }
  }

  // Workouts
  interface WorkoutRow extends Row { id: number; date: string; }
  const thisWeekWorkouts = query<WorkoutRow>(
    `SELECT id, date FROM workouts WHERE user_id = 1 AND date >= ? AND date <= ?`,
    [weekStart, weekEnd],
  );
  const workoutCount = thisWeekWorkouts.length;
  const daysTrained = new Set(thisWeekWorkouts.map((w) => w.date)).size;

  // Adherence
  const calLogs = thisWeekLogs.filter((l) => l.calories_in != null);
  const proteinLogs = thisWeekLogs.filter((l) => l.protein_g != null);
  const calHit = calLogs.filter((l) => (l.calories_in ?? 0) >= targetCalories * 0.8).length;
  const proteinHit = proteinLogs.filter((l) => (l.protein_g ?? 0) >= targetProtein * 0.9).length;
  const calorieAdherence = calLogs.length > 0 ? Math.round((calHit / calLogs.length) * 100) : 0;
  const proteinAdherence = proteinLogs.length > 0 ? Math.round((proteinHit / proteinLogs.length) * 100) : 0;

  // Best exercise
  function volumeForWorkouts(ids: number[]): Map<string, number> {
    const map = new Map<string, number>();
    if (ids.length === 0) return map;
    for (const id of ids) {
      const sets = query<{ exercise_name: string; weight: number; reps: number } & Row>(
        `SELECT exercise_name, weight, reps FROM workout_sets WHERE workout_id = ?`,
        [id],
      );
      for (const s of sets) {
        map.set(s.exercise_name, (map.get(s.exercise_name) ?? 0) + s.weight * s.reps);
      }
    }
    return map;
  }

  interface PrevWorkoutRow extends Row { id: number; }
  const prevWorkouts = query<PrevWorkoutRow>(
    `SELECT id FROM workouts WHERE user_id = 1 AND date >= ? AND date <= ?`,
    [prevWeekStart, prevWeekEnd],
  );
  const thisVol = volumeForWorkouts(thisWeekWorkouts.map((w) => w.id));
  const prevVol = volumeForWorkouts(prevWorkouts.map((w) => w.id as number));

  let bestExercise: { name: string; volumeDelta: number } | null = null;
  for (const [name, vol] of thisVol.entries()) {
    const prev = prevVol.get(name) ?? 0;
    const delta = vol - prev;
    if (bestExercise === null || delta > bestExercise.volumeDelta) {
      bestExercise = { name, volumeDelta: Math.round(delta) };
    }
  }
  if (bestExercise && bestExercise.volumeDelta <= 0) bestExercise = null;

  // Summary text
  const parts: string[] = [];
  if (weightLostKg != null && weightLostKg > 0) parts.push(`Lost ${weightLostKg} kg`);
  else if (weightLostKg != null && weightLostKg < 0) parts.push(`Gained ${Math.abs(weightLostKg)} kg`);
  if (workoutCount > 0) parts.push(`${workoutCount} workout${workoutCount !== 1 ? 's' : ''}`);
  if (proteinLogs.length > 0) parts.push(`Protein hit ${proteinHit}/${proteinLogs.length} days`);
  if (bestExercise) parts.push(`PR on ${bestExercise.name}`);
  const summaryText = parts.length > 0 ? parts.join(' · ') : 'No data yet this week.';

  return { weekStart, weekEnd, weightLostKg, workoutCount, daysTrained, calorieAdherence, proteinAdherence, bestExercise, summaryText };
}

// ── Tool: get_overload_report ──────────────────────────────────────────────

function getOverloadReport(exerciseName: string) {
  interface SetRow2 extends Row { week_start: string; weight: number; reps: number; }
  const rows = query<SetRow2>(
    `SELECT
       date(w.date, 'weekday 1', '-7 days') AS week_start,
       ws.weight,
       ws.reps
     FROM workout_sets ws
     JOIN workouts w ON ws.workout_id = w.id
     WHERE ws.exercise_name = ? AND w.user_id = 1
     ORDER BY week_start ASC`,
    [exerciseName],
  );

  const weeks = new Map<string, { totalVolume: number; topSetWeight: number; topSetReps: number }>();
  for (const row of rows) {
    const ws = row.week_start as string;
    const vol = row.weight * row.reps;
    if (!weeks.has(ws)) {
      weeks.set(ws, { totalVolume: 0, topSetWeight: 0, topSetReps: 0 });
    }
    const entry = weeks.get(ws)!;
    entry.totalVolume += vol;
    if (row.weight > entry.topSetWeight || (row.weight === entry.topSetWeight && row.reps > entry.topSetReps)) {
      entry.topSetWeight = row.weight;
      entry.topSetReps = row.reps;
    }
  }

  const weekList = [...weeks.entries()].map(([weekStart, data]) => ({
    weekStart,
    totalVolume: Math.round(data.totalVolume),
    topSetWeight: data.topSetWeight,
    topSetReps: data.topSetReps,
  }));

  // Compute trend from last 3 weeks
  let trend: 'improving' | 'stalling' | 'declining' = 'declining';
  if (weekList.length >= 3) {
    const last3 = weekList.slice(-3);
    const vols = last3.map((w) => w.totalVolume);
    const maxVol = Math.max(...vols);
    const minVol = Math.min(...vols);
    const variance = maxVol > 0 ? (maxVol - minVol) / maxVol : 0;
    if (variance < 0.05) {
      trend = 'stalling';
    } else if (vols[2] > vols[1] && vols[1] >= vols[0]) {
      trend = 'improving';
    } else if (vols[2] > vols[0]) {
      trend = 'improving';
    } else {
      trend = 'declining';
    }
  } else if (weekList.length > 0) {
    trend = 'improving';
  }

  return { exercise: exerciseName, weeks: weekList, trend };
}

// ── MCP server setup ───────────────────────────────────────────────────────

const server = new Server(
  { name: 'bws-tracker', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_fitness_summary',
      description:
        'Returns the last N days of fitness data (weight, 7-day rolling average, steps, calories, protein) from the BWS Tracker database.',
      inputSchema: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to fetch (default 14, max 90)',
          },
        },
      },
    },
    {
      name: 'get_exercise_history',
      description:
        'Returns the full historical log for a specific exercise across all workout sessions, including per-session top set for progressive overload analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          exercise_name: {
            type: 'string',
            description:
              'Exact exercise name as stored in the database (e.g. "Bench Press", "Barbell Squat")',
          },
        },
        required: ['exercise_name'],
      },
    },
    {
      name: 'get_weekly_summary',
      description:
        'Returns the current ISO week (Monday–Sunday) aggregate summary: weight lost, workout count, days trained, calorie/protein adherence %, best exercise PR, and a human-readable summary string.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_overload_report',
      description:
        'Returns a week-by-week progressive overload report for a specific exercise: total volume, top set weight/reps per week, ordered oldest→newest, plus an overall trend (improving/stalling/declining).',
      inputSchema: {
        type: 'object',
        properties: {
          exercise_name: {
            type: 'string',
            description: 'Exact exercise name (e.g. "Bench Press", "Barbell Squat")',
          },
        },
        required: ['exercise_name'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_fitness_summary') {
      const days =
        typeof args?.days === 'number' ? Math.min(args.days, 90) : 14;
      const data = getFitnessSummary(days);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    if (name === 'get_exercise_history') {
      if (typeof args?.exercise_name !== 'string') {
        throw new Error('exercise_name is required');
      }
      const data = getExerciseHistory(args.exercise_name);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    if (name === 'get_weekly_summary') {
      const data = getWeeklySummary();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    if (name === 'get_overload_report') {
      if (typeof args?.exercise_name !== 'string') {
        throw new Error('exercise_name is required');
      }
      const data = getOverloadReport(args.exercise_name);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ],
      isError: true,
    };
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('BWS MCP server running on stdio\n');
