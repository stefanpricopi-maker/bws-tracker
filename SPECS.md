# BWS Tracker — Project Specs & Progress

> **Strict, math-based fitness tracking.** Every number has a formula. Every target has a reason.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Astro 5 (SSR mode, `output: 'server'`) |
| UI Components | React 19 (`client:load` islands) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Database (local/Docker) | LibSQL (`@libsql/client`) via Drizzle ORM — `file:./bws.db` |
| Database (production) | Turso (LibSQL cloud) — `libsql://...turso.io` |
| Charts | Recharts |
| MCP Server | `@modelcontextprotocol/sdk` + `sql.js` (WASM) |
| Wearable Data | Google Fit REST API (OAuth2 via `googleapis`) |
| AI Coach | OpenAI-compatible API (Groq by default) |
| Deployment | Vercel (`@astrojs/vercel` adapter) |
| Docker | Multi-stage Node.js image + docker-compose stack |

---

## Database Schema (`src/db/schema.ts`)

```
users           id | name | created_at
daily_logs      id | user_id → users | date | weight_kg | steps | calories_in | protein_g | carbs_g | fat_g
workouts        id | user_id → users | date | day_type
workout_sets    id | workout_id → workouts | exercise_name | weight | reps | set_number
user_goals      id | user_id → users | target_weight_kg | weekly_weight_loss_kg | tdee_kcal |
                    target_calories_kcal | target_protein_g | target_carbs_g | target_fat_g |
                    target_steps | updated_at
google_tokens   id | user_id → users | access_token | refresh_token | expiry_date
```

All FK relationships use `ON DELETE CASCADE`.
All Drizzle queries are **async** (LibSQL returns Promises — no `.all()` / `.get()` suffixes).

---

## API Routes (`src/pages/api/`)

| Route | Methods | Description |
|---|---|---|
| `/api/logs` | GET, POST | Fetch last N days of `daily_logs` / upsert by `(userId, date)` |
| `/api/workouts` | GET, POST | Progressive overload lookup by exercise / save workout + sets |
| `/api/analytics` | GET | Compute BWS Score + all fitness metrics for user 1 |
| `/api/profile` | GET, POST | Fetch user + goals / upsert user name + `user_goals` |
| `/api/alerts` | GET | Active trend alerts (stall, under-eating, inactivity, step deficit) |
| `/api/weekly-summary` | GET | Current week aggregates (weight delta, workout count, macro adherence, best exercise) |
| `/api/ai-coach` | GET | LLM weekly analysis: fetches last 7 days, applies 4 coaching rules, returns text |
| `/api/auth/google/login` | GET | Redirect to Google OAuth2 consent screen |
| `/api/auth/google/callback` | GET | Exchange auth code for tokens, save to `google_tokens` |
| `/api/google-fit` | GET | Fetch steps, active calories, sleep from Google Fit for a given date |
| `/api/google-fit-sessions` | GET | Fetch workout sessions from Google Fit Sessions API |

---

## UI Components (`src/components/`)

| Component | Tab | Description |
|---|---|---|
| `Dashboard.tsx` | — | Tab controller (top nav): Dashboard / Workout / Diet / Profile |
| `BWSScore.tsx` | Dashboard | SVG progress ring + 4 breakdown bars + 2×3 stats grid |
| `WeightTrend.tsx` | Dashboard | 30-day weight log form + 7-day rolling average Recharts chart |
| `StepTracker.tsx` | Dashboard | Step input + progress bar (turns green at 10k) + NEAT burn estimate |
| `ConsistencyHeatmap.tsx` | Dashboard | GitHub-style 30-day adherence calendar with green streak counter |
| `WeeklyCheckIn.tsx` | Dashboard | AI Coach weekly analysis button + LLM response card |
| `WorkoutLogger.tsx` | Workout | 7-day split selector + auto-regulation pre-fill + Google Fit session sync |
| `DietTracker.tsx` | Diet | SVG calorie ring + macro progress bars + intake form + active burn eat-back |
| `ProfileSettings.tsx` | Profile | Name, body goals, macro targets, inline Mifflin-St Jeor TDEE calculator |
| `InstallPrompt.tsx` | — | "Add to Home Screen" PWA install banner |
| `WeightChart.tsx` | — | Reusable Recharts LineChart (used by `/weight` page) |
| `StatCard.tsx` | — | Reusable stat tile (value + unit + delta) |

---

## Layouts & Pages

- `src/layouts/Layout.astro` — Mobile shell (`max-w-md mx-auto`), PWA meta tags, SW registration
- `src/pages/index.astro` — Main entry: `<Dashboard client:load />` + `<InstallPrompt client:load />`
- `src/pages/weight.astro` — Standalone weight trend page (SSR data fetch from DB)

---

## MCP Server (`mcp-server/`)

Runs over **stdio**. Uses `sql.js` (pure WASM, no native modules — avoids Node ABI mismatch with Cursor's embedded Node).

### Tools

| Tool | Input | Output |
|---|---|---|
| `get_fitness_summary` | `days?: number` (default 14, max 90) | Last N days: date, weight_kg, weight_7d_avg, steps, calories_in, protein_g |
| `get_exercise_history` | `exercise_name: string` | All historical sets grouped by session date, with per-session top set |
| `get_weekly_summary` | — | Current week aggregates (weight lost, workout count, macro adherence %, best exercise) |
| `get_overload_report` | `exercise_name: string` | Week-by-week volume trend, peak week, current vs last week delta |

### Cursor MCP Config (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "bws-tracker": {
      "command": "node",
      "args": ["/Users/pricopistefan/bws-tracker/mcp-server/dist/index.js"]
    }
  }
}
```

> **Note:** `dist/` is gitignored. Run `cd mcp-server && npm run build` once after cloning on a new machine.

---

## BWS Score Formula

Composite score 0–100 computed from last 7 days of data. Reads targets from `user_goals` (falls back to defaults).

| Component | Max pts | Formula |
|---|---|---|
| Weight Pace | 25 | `clamp(1 - |Δweight_7d| / 0.5, 0, 1) × 25` — ~0.5 kg/week loss = perfect |
| Nutrition | 25 | `clamp(avgCalories_7d / targetCalories, 0, 1) × 25` |
| Protein | 25 | `clamp(avgProtein_7d / targetProtein, 0, 1) × 25` |
| Activity | 25 | `clamp(avgSteps_7d / targetSteps, 0, 1) × 12.5 + clamp(workouts_7d / 4, 0, 1) × 12.5` |

Score color: violet < 60 · amber 60–79 · green ≥ 80.

---

## Auto-Regulation Rules (Phase 12)

Applied automatically when loading an exercise in WorkoutLogger, based on the best set of the previous session:

| Rule | Condition | Pre-filled target |
|---|---|---|
| Rule A (progress) | `prev_max_reps >= 10` | weight `+ 2.5 kg`, reps `= 8` |
| Rule B (accumulate) | `prev_max_reps < 10` | weight `= same`, reps `= prev_max_reps + 1` |

Visual indicator: ⬆️ +2.5 kg badge when Rule A applies. Target hint always shown below inputs.

---

## Consistency Heatmap Logic (Phase 13)

30-day grid, one square per day. Color rules:

| Color | Class | Condition |
|---|---|---|
| Ideal | `bg-emerald-500` | `1200 ≤ calories_in ≤ 1850` AND `steps ≥ 10 000` |
| Active | `bg-emerald-300` | `steps ≥ 10 000` but calories missed or not logged |
| Surplus | `bg-red-500` | `calories_in > 1850` |
| Missed | `bg-gray-800` | No data or both targets missed |

Green streak = consecutive Ideal or Active days counted backwards from today.

---

## AI Coach Rules (Phase 14)

System prompt sent to LLM with last 7 days of data:

- **Rule 1:** Weight loss 0.5–0.8 kg → maintain 1850 kcal
- **Rule 2:** Weight loss < 0.2 kg AND steps < 10 000 → increase steps before dropping calories
- **Rule 3:** Response under 3 sentences, direct, no fluff
- **Rule 4:** Insufficient data (< 3 days logged) → prompt user to log consistently first

Env vars: `AI_API_KEY`, `AI_API_BASE_URL` (default: Groq), `AI_MODEL`.

---

## Google Fit Integration (Phase 11)

OAuth2 scopes: `fitness.activity.read`, `fitness.sleep.read`.

### Daily Metrics (`fetchDailyMetrics`)
- Steps: `derived:com.google.step_count.delta`
- Active calories: `derived:com.google.calories.expended`
- Sleep: `derived:com.google.sleep.segment`

### Workout Sessions (`fetchWorkoutSessions`)
Excluded activity types: `0` (unknown), `3` (still), `72` (sleep), `80` (in vehicle).
Duration filter: sessions `< 5 min` or `> 300 min` are discarded.
All other types (including `108` — "Other activity") are included.

---

## Active Burn Eat-Back Rule (DietTracker)

| Active burn | Behaviour |
|---|---|
| `< 600 kcal` | No adjustment shown |
| `≥ 600 kcal` | Eat back `min(activeBurn × 0.5, 500)` kcal above base target |

Rationale: base target already includes a deficit; eating back 100% would erase it.

---

## Workout Split (7-Day Hybrid)

| Day | Type | Focus |
|---|---|---|
| 1 | Push | Bench Press, Overhead Press, Incline DB Press, Lateral Raises, Tricep Pushdowns, OH Tricep Extensions |
| 2 | Pull | Barbell Row, Pull-Ups, Seated Cable Row, Face Pulls, Barbell Curl, Hammer Curl |
| 3 | Legs | Barbell Squat, Romanian Deadlift, Leg Press, Leg Curl, Calf Raises |
| 4 | Rest | — |
| 5 | Upper | Incline Bench Press, Incline DB Curl, Cable Fly, Tricep Dips, Concentration Curl |
| 6 | Legs + Arms | Front Squat, Crossbody Hammer Curl, Leg Extension, Preacher Curl, Seated Calf Raise |
| 7 | Rest | — |

---

## Hardcoded Defaults (overridden by `user_goals`)

| Target | Default |
|---|---|
| Calories | 1850 kcal |
| Protein | 180 g |
| Carbs | 113 g |
| Fat | 75 g |
| Steps | 10,000 |
| Weekly weight loss | 0.5 kg/week |

---

## Scripts

```bash
npm run dev                   # Astro dev server → http://localhost:4321
npm run build                 # Production build (Vercel adapter)
npm run db:generate           # Drizzle: diff schema → new SQL migration file
npm run db:migrate            # Drizzle: apply pending migrations
npm run db:push               # Drizzle: push schema directly to Turso (no migration file)
npm run db:studio             # Drizzle Studio (DB GUI)

# Docker
docker compose up --build     # Build + start web app + MCP server

# MCP server
cd mcp-server && npm run build   # Compile TypeScript → dist/

# Turso CLI
turso auth login
turso db create bws-tracker
turso db show bws-tracker --url
turso db tokens create bws-tracker
turso db shell bws-tracker ".tables"
```

---

## Infrastructure

### Docker (`Dockerfile` + `docker-compose.yml`)
- Multi-stage build: `node:22-alpine` builder → slim runtime image
- Uses `astro.config.docker.mjs` (Node standalone adapter) — separate from Vercel config
- Runs `scripts/migrate.mjs` at startup to apply SQL migrations + seed default user
- Services: `web` (port 4321) + `mcp` (stdio, reads same DB volume)
- DB path inside container: `file:/data/bws.db`

### Vercel
- Adapter: `@astrojs/vercel` (auto-detected via `astro.config.mjs`)
- `vercel.json`: framework `astro`, region `fra1` (Frankfurt)
- Required env vars on Vercel: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`

### Turso (Production DB)
- DB name: `bws-tracker`
- Region: `aws-eu-west-1`
- URL: `libsql://bws-tracker-stefanpricopi.aws-eu-west-1.turso.io`

---

## PWA

- **Manifest:** `public/manifest.webmanifest` — standalone display, violet theme
- **Service Worker:** `public/sw.js` — cache-first, skips `/api/` routes, offline shell support
- **Icons:** `public/icons/icon-192.svg`, `icon-512.svg` — violet rounded square with "BWS" text
- **Install prompt:** `InstallPrompt.tsx` — `beforeinstallprompt` API banner

---

## Completed Phases

- [x] **Phase 1** — Project foundation: Astro SSR, Drizzle + SQLite, schema, first migration
- [x] **Phase 2** — Layout shell + WeightTrend: `Layout.astro`, bottom nav → top nav, 7-day rolling average chart
- [x] **Phase 3** — Nutrition & NEAT: `DietTracker`, `StepTracker`, API routes, full DB persistence
- [x] **Phase 4** — Workout Logger: 7-day split, progressive overload engine, `WorkoutLogger`, workout API
- [x] **Phase 5** — MCP Server: stdio server, `get_fitness_summary`, `get_exercise_history`, connected to Cursor
- [x] **Phase 6A** — BWS Score: composite 0–100 score, SVG ring, breakdown bars, stats grid
- [x] **Phase 6B** — Profile & Goals: `user_goals` table, TDEE calculator, targets saved to DB, score uses real targets
- [x] **Phase 6C** — PWA: manifest, service worker, install prompt, iOS meta, mobile polish
- [x] **Phase 7** — Data Intelligence: trend alerts, overload badges, weekly summary card, new MCP tools
- [x] **Phase 10** — Containerization: Dockerfile, docker-compose, `.dockerignore`, LibSQL migration from `better-sqlite3`
- [x] **Phase 11** — Google Fit: OAuth2 flow, daily metrics sync (steps/calories/sleep), workout session import with filtering
- [x] **Phase 12** — Auto-Regulation Engine: Rule A/B pre-fill, ⬆️ weight increase badge, target hint
- [x] **Phase 13** — Consistency Heatmap: 30-day GitHub-style calendar, 4-tier color logic, green streak counter
- [x] **Phase 14** — AI Coach: weekly LLM analysis, 4 coaching rules, `WeeklyCheckIn` component, Groq integration
- [x] **Phase 15** — Production deployment: Turso cloud DB, Vercel adapter, `db:push` script, dual config (Vercel + Docker)
