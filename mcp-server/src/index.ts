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
