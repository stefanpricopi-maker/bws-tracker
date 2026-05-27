# BWS Tracker — Project Specs & Progress

> **Strict, math-based fitness tracking.** Every number has a formula. Every target has a reason.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Astro 5 (SSR mode, `output: 'server'`) |
| UI Components | React 19 (`client:load` islands) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Database | SQLite via Drizzle ORM + `better-sqlite3` |
| Charts | Recharts |
| MCP Server | `@modelcontextprotocol/sdk` + `sql.js` (WASM) |

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
```

All FK relationships use `ON DELETE CASCADE`.

---

## API Routes (`src/pages/api/`)

| Route | Methods | Description |
|---|---|---|
| `/api/logs` | GET, POST | Fetch last N days of `daily_logs` / upsert by `(userId, date)` |
| `/api/workouts` | GET, POST | Progressive overload lookup by exercise / save workout + sets |
| `/api/analytics` | GET | Compute BWS Score + all fitness metrics for user 1 |
| `/api/profile` | GET, POST | Fetch user + goals / upsert user name + `user_goals` |

All DB operations are synchronous (`better-sqlite3`). No `await` on Drizzle queries.

---

## UI Components (`src/components/`)

| Component | Tab | Description |
|---|---|---|
| `Dashboard.tsx` | — | Tab controller (top nav): Dashboard / Workout / Diet / Profile |
| `BWSScore.tsx` | Dashboard | SVG progress ring + 4 breakdown bars + 2×3 stats grid |
| `WeightTrend.tsx` | Dashboard | 30-day weight log form + 7-day rolling average Recharts chart |
| `StepTracker.tsx` | Dashboard | Step input + progress bar (turns green at 10k) + NEAT burn estimate |
| `WorkoutLogger.tsx` | Workout | 7-day split selector + progressive overload display + 3-set input rows |
| `DietTracker.tsx` | Diet | SVG calorie ring + macro progress bars + intake form |
| `ProfileSettings.tsx` | Profile | Name, body goals, macro targets, inline Mifflin-St Jeor TDEE calculator |
| `InstallPrompt.tsx` | — | "Add to Home Screen" PWA install banner |
| `WeightChart.tsx` | — | Reusable Recharts LineChart (used by `/weight` page) |
| `StatCard.tsx` | — | Reusable stat tile (value + unit + delta) |
| `BottomNav.tsx` | — | Legacy nav (superseded by Dashboard's top nav) |

---

## Layouts & Pages

- `src/layouts/Layout.astro` — Mobile shell (`max-w-md mx-auto`), PWA meta tags, SW registration
- `src/pages/index.astro` — Main entry: `<Dashboard client:load />` + `<InstallPrompt client:load />`
- `src/pages/weight.astro` — Standalone weight trend page (SSR data fetch from DB)
- `src/pages/workouts.astro`, `log.astro`, `profile.astro` — Stub pages (navigation via Dashboard tabs)

---

## MCP Server (`mcp-server/`)

Runs over **stdio**. Uses `sql.js` (pure WASM, no native modules — avoids Node ABI mismatch with Cursor's embedded Node 22).

### Tools

| Tool | Input | Output |
|---|---|---|
| `get_fitness_summary` | `days?: number` (default 14, max 90) | Last N days: date, weight_kg, weight_7d_avg, steps, calories_in, protein_g |
| `get_exercise_history` | `exercise_name: string` | All historical sets grouped by session date, with per-session top set |

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
npm run dev              # Start Astro dev server → http://localhost:4321
npm run build            # Production build
npm run db:generate      # Drizzle: diff schema → new SQL migration file
npm run db:migrate       # Drizzle: apply pending migrations to bws.db
npm run db:studio        # Drizzle Studio (local DB GUI)
npx tsx src/scripts/seed.ts           # Seed 30 days of demo data for user 1
npx tsx src/scripts/generate-icons.ts # Regenerate PWA SVG icons
cd mcp-server && npm run build        # Compile MCP server TypeScript
```

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

---

## Phase 7 — Data Intelligence & Insights

### 7.1 Trend Alerts
- [ ] Detect stall: weight unchanged (< 0.1 kg Δ) for 5+ consecutive logged days
- [ ] Detect under-eating: avg calories last 3 days < 80% of target
- [ ] Detect inactivity: no workout logged in 4+ days
- [ ] Detect step deficit: avg steps last 3 days < 60% of target
- [ ] UI: colored alert banner on Dashboard tab (dismissible per-day, stored in localStorage)
- [ ] API: `GET /api/alerts` — returns active alerts array

### 7.2 Progressive Overload Report (in WorkoutLogger)
- [ ] After fetching previous session stats, compute delta vs current input in real-time
- [ ] Show inline badge per exercise: `▲ +2.5 kg`, `▲ +1 rep`, `→ Same`, `▼ Dropped`
- [ ] Badge appears after user fills in weight/reps for a set
- [ ] Color: green for progress, gray for same, red for regression

### 7.3 Weekly Summary Card
- [ ] API: `GET /api/weekly-summary` — aggregates current week (Mon–Sun):
  - Weight lost this week (kg)
  - Workout count + days trained
  - Macro adherence % (calories, protein)
  - Best exercise this week (highest weight×reps volume delta vs previous week)
- [ ] UI: `WeeklySummary.tsx` — collapsible card on Dashboard, shown every Monday auto-expanded
- [ ] Generates human-readable summary string (e.g. "You lost 0.4 kg, hit protein 5/7 days, PR on Bench Press")

### 7.4 New MCP Tools
- [ ] `get_weekly_summary` — returns current week aggregates (same data as API)
- [ ] `get_overload_report` — accepts `exercise_name`, returns week-by-week volume (sets × reps × weight) trend, peak week, current week vs last week delta
- [ ] Add both tools to `mcp-server/src/index.ts`, rebuild `dist/`
