# BWS Tracker — Project Specs & Progress

> **Strict, math-based fitness tracking.** Every number has a formula. Every target has a reason.

**Backlog & priorities:** see [TODO.md](./TODO.md).

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
| Tests | Vitest (`src/lib/*.test.ts`, `tests/integration/*`) · Playwright (`e2e/`) |
| CI | GitHub Actions — `npm test` + `npm run build` |
| MCP Server | `@modelcontextprotocol/sdk` + `sql.js` (WASM) |
| Wearable Data | Google Fit REST API (OAuth2 via `googleapis`) |
| AI Coach / Planner | OpenAI-compatible API (Groq by default) |
| Deployment | Vercel (`@astrojs/vercel` adapter) |
| Docker | Multi-stage Node.js image + docker-compose stack |

---

## Database Schema (`src/db/schema.ts`)

```
users           id | name | created_at

daily_logs      id | user_id → users | date | weight_kg | steps | calories_in |
                    protein_g | carbs_g | fat_g | photo_url

workouts        id | user_id → users | date | day_type

workout_sets    id | workout_id → workouts | exercise_name | weight | reps | set_number | rpe
                (weight: kg for dumbbells; 1–3 = Light/Medium/Heavy for banded exercises)

block_history   id | user_id → users | block | started_at | ended_at

user_goals      id | user_id → users | target_weight_kg | weekly_weight_loss_kg | tdee_kcal |
                    target_calories_kcal | target_protein_g | target_carbs_g | target_fat_g |
                    target_steps | updated_at

google_tokens   id | user_id → users | access_token | refresh_token | expiry_date

mesocycles      id | user_id → users (unique) | current_block | block_start_date | updated_at

exercises       id | name (unique) | target_muscle | category | image_url |
                    is_custom | is_archived | created_at
```

All FK relationships use `ON DELETE CASCADE`.  
All Drizzle queries are **async** (LibSQL returns Promises).

**Migrations:** Drizzle SQL in `drizzle/` (through `0004_block_history_rpe`). Prod: `npm run db:migrate`; if `__drizzle_migrations` was empty on an existing DB, run `npm run db:baseline` once (see `docs/STAGING.md`).

### Auth (`src/lib/auth.ts`, `src/lib/apiAuth.ts`)

| Mode | Behaviour |
|---|---|
| **Auth off** (default) | No `BWS_AUTH_SECRET` → all APIs use `userId = 1` |
| **Auth on** | `BWS_AUTH_SECRET` + `BWS_LOGIN_PASSWORD` → cookie session; `requireUser()` returns 401 without login |

- Login: `POST /api/auth/login` · Session: `GET /api/auth/me` · Logout: `POST /api/auth/logout`
- Google Fit OAuth is separate (`/api/auth/google/*`)
- **Multi-user signup** is not implemented yet ([TODO.md](./TODO.md) → Idei viitoare)

---

## Core Libraries (`src/lib/`)

| Module | Role |
|---|---|
| `fitness.ts` | BWS score, rolling average, `heatmapThresholdsFromGoals`, CNS deload, `autoRegulate`, `calcForecast` (stagnant only when cutting, `FORECAST_STAGNANT_WEEKLY_KG = -0.25`) |
| `periodization.ts` | 8-week mesocycle, `EXERCISE_SWAP`, `missingBlock2Swaps`, `isDeloadWeek`, `deloadSetCount` (~40% volume) |
| `exerciseKind.ts` | `isBandedExercise`, band levels 1–3, `formatExerciseLoad` |
| `macroTargets.ts` | Protein 1.8 g/kg, `resolveDietTargets`, macro split |
| `workoutValidation.ts` | Workout/set POST validation (kg, reps, bands) |
| `logValidation.ts` | Daily log POST validation (weight, macros, steps ranges) |
| `urlValidation.ts` | HTTPS image URLs for exercise library |
| `workoutSafety.ts` | M.E.D. high-risk hints, warmup set heuristics |
| `apiAuth.ts` | `requireUser()` + optional per-route rate limits |
| `rateLimit.ts` | In-memory IP/window limits for AI and heavy routes |
| `auth.ts` | Session cookie HMAC, login password check |
| `tdee.ts` | Onboarding / profile TDEE from weight |
| `i18n.ts` | RO/EN strings (nav, preferences) |
| `googleFit.ts` / `googleTokenStore.ts` | Google Fit API + token refresh |
| `restDuration.ts` | Rest timer seconds by exercise type |

---

## API Routes (`src/pages/api/`)

All data routes resolve the current user via `requireUser()` or `resolveUserId()` (see Auth).  
**Rate limits** (when auth enabled or always on route key): e.g. `workouts`, `ai-coach`, `generate-weekly-plan` (10/min), `vision` (15/min), `macro-solver` (10/min).

| Route | Methods | Description |
|---|---|---|
| `/api/logs` | GET, POST | Daily logs; POST validated via `logValidation.ts` |
| `/api/workouts` | GET, POST | Overload lookup (`needs_deload`) / save workout + sets |
| `/api/workout-set` | POST, DELETE | Player live set (+ optional `rpe`); DELETE drops partial session |
| `/api/mesocycle` | GET, POST | Block/week, deload flag, `block_history`; advance block |
| `/api/exercises` | GET, POST | Library: `?limit=&offset=&category=` → `{ exercises, total, limit, offset }`; POST + image URL validation |
| `/api/daily-status` | GET | Today’s checklist (`DailyActionHero`) |
| `/api/generate-weekly-plan` | GET | LLM weekly plan (set counts; respects deload week) |
| `/api/analytics` | GET | BWS score + metrics |
| `/api/profile` | GET, POST | User + `user_goals` |
| `/api/forecast` | GET | Goal projection (`calcForecast`) |
| `/api/alerts` | GET | Trend alerts |
| `/api/weekly-summary` | GET | Week aggregates |
| `/api/ai-coach` | GET | LLM weekly analysis |
| `/api/macro-solver` | GET | AI macro fill from remaining calories |
| `/api/export` | GET | CSV export `?days=90` |
| `/api/upload-photo` | POST | Progress photo (Vercel Blob) |
| `/api/vision` | POST | Food photo → macros |
| `/api/sync/google-fit` | GET | Sync steps/calories/sleep into today’s log |
| `/api/google-fit-sessions` | GET | Filtered workout sessions |
| `/api/auth/login` | POST | App password → session cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/me` | GET | Session status |
| `/api/auth/google/login` | GET | Google OAuth redirect |
| `/api/auth/google/callback` | GET | Google token storage |
| `/api/health` | GET | Env presence check (no auth) |

---

## Navigation & UI (`src/components/`)

### Main app (`index.astro` → `Dashboard.tsx`)

Top nav (5 tabs):

| Tab | ID | Main components |
|---|---|---|
| Home | `dashboard` | `DailyActionHero`, `StepTracker`, `AlertBanner`, `GoalForecaster`, `ConsistencyHeatmap`, `WeeklyCheckIn`, `WeeklySummary`, `PullToRefresh` |
| Workout | `workout` | `WorkoutLogger` (+ `WorkoutPlayer` via `WorkoutPlayerProvider`), `ExerciseManager` (paginated library) |
| Diet | `diet` | `DietTracker` (targets from `macroTargets` + profile / latest weight) |
| Stats | `stats` | `BWSScore`, `WeightTrend` |
| Profile | `profile` | `ProfileSettings` · `PhotoVault` (sub-tabs Settings / Photos) |

**Overlays:** `Onboarding` (TDEE from weight), `WorkoutPlayer`, `InstallPrompt` (PWA).  
**Preferences (Profile):** i18n RO/EN, dark/light `data-theme`, PWA notifications toggle, CSV export link.

### Legacy / secondary

| Component | Page | Notes |
|---|---|---|
| `BottomNav.tsx` | `/weight` via `AppLayout.astro` | Standalone weight page only |
| `WeightChart.tsx` | `/weight` | SSR chart |

---

## Workout System

### Home-gym split (7 days)

Dumbbells + resistance bands only. See `SPLIT` in `WorkoutLogger.tsx`.

| Day | Type | Notes |
|---|---|---|
| 1 | Push | Floor press, OHP, push-ups, band flyes, laterals, triceps |
| 2 | Pull | Rows, band pulldown, pullover, face pulls, curls |
| 3 | Legs | Split squat, goblet, RDL, band leg curl, calves |
| 4 | Rest | — |
| 5 | Upper | Press + row + accessories |
| 6 | Legs+Arms | Legs + arms mix |
| 7 | Rest | — |

**M.E.D. mode:** single primary compound, Myo-Reps (ACT + M1–M3; deload week: ACT + M1 only).

### Mesocycle (8 weeks per block)

| Weeks (display) | Phase |
|---|---|
| 1–7 | Progressive work; Block 1 or Block 2 exercises (`EXERCISE_SWAP`) |
| 8 | **Deload week:** `deloadSetCount()` (~40% fewer sets), loads ~12.5% lighter (`DELOAD_LOAD_FACTOR = 0.875`) |
| After week 8 | User advances block via UI → POST `/api/mesocycle` (appends `block_history`) |

UI warns when Block 2 has no entry in `EXERCISE_SWAP` (`missingBlock2Swaps`).

### Auto-regulation (progressive overload)

Applied when loading previous session data (`GET /api/workouts?exercise_name=…`):

| Type | Rule A (progress) | Rule B (accumulate) |
|---|---|---|
| Dumbbells | `maxReps ≥ 10` → `+2.5 kg` compound / `+1 kg` isolation, reps → 8 | same weight, reps → `maxReps + 1` |
| Bands | `maxReps ≥ 10` & level &lt; 3 → level +1, reps → 8 | same level, reps → `maxReps + 1` |

Visual: ⬆️ badge (kg increment), 🎯 target line, 🔻 CNS or mesocycle deload.

### CNS deload (stagnation)

- Last **3 sessions** within **56 days** with no improvement in **both** weight and reps → `needs_deload: true`
- Load: `calcDeloadWeight(max)` (~12.5% off kg; bands drop one level)
- Independent of mesocycle week 8 (both can apply)

### Banded exercises

- Stored `weight` = `1 | 2 | 3` (Light / Medium / Heavy)
- UI: band dropdown, `formatExerciseLoad()` in Previous / Target lines
- Validation: `workoutValidation.ts`

### WorkoutPlayer (`WorkoutPlayerContext` starts session from Logger)

- Load session: exercise images + auto-reg targets per exercise
- **Warmup** prompt on set 1 for compounds (`workoutSafety.ts`)
- Optional **RPE** (1–10) per set; **superset** mode (shorter rest)
- M.E.D. high-risk banner on sensitive lifts
- Rest timer by `restDuration.ts`; quit → `DELETE` partial workout
- Started via `WorkoutPlayerProvider` in `Dashboard` (no prop drilling)

---

## BWS Score Formula

Composite score 0–100 from last 7 days. Targets from `user_goals` (fallback defaults).

| Component | Max pts | Formula |
|---|---|---|
| Weight Pace | 25 | `clamp(1 - |Δweight_7d| / 0.5, 0, 1) × 25` |
| Nutrition | 25 | `clamp(avgCalories_7d / targetCalories, 0, 1) × 25` |
| Protein | 25 | `clamp(avgProtein_7d / targetProtein, 0, 1) × 25` |
| Activity | 25 | steps half + workouts half (`/ 4` sessions) |

Score color: violet &lt; 60 · amber 60–79 · green ≥ 80.  
**Stats tab** shows trend pill on score when applicable.

---

## Diet & Macros

| Source | Behaviour |
|---|---|
| Profile `user_goals` | Overrides when set |
| Body weight | Protein default **1.8 g/kg** (`macroTargets.ts`) |
| TDEE calculator (Profile) | Sets calories + derives P/C/F from weight |
| `DietTracker` | Loads `/api/profile` + `/api/logs?days=30`; macro split bar (P/C/F then kcal); auto kcal from macros on edit |
| Active burn | Eat-back `min(activeBurn × 0.5, 500)` when burn ≥ 600 kcal (base target already in deficit) |

Google Fit active calories: treated as **NEAT / activity**, not “sport burn” in copy.

---

## Consistency Heatmap

30-day grid. Thresholds from `heatmapThresholdsFromGoals()` using profile `user_goals` (calories ±15%, steps target).  
**Future:** % deficit vs TDEE for calorie bands ([TODO.md](./TODO.md)).

---

## AI Coach Rules

System prompt + last 7 days:

1. Weight loss 0.5–0.8 kg → maintain calories  
2. Loss &lt; 0.2 kg AND steps &lt; 10k → increase steps before cutting calories  
3. Response &lt; 3 sentences  
4. &lt; 3 days logged → ask for consistency first  

Env: `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`.

**Errors:** All AI routes use `src/lib/aiApi.ts` — JSON `{ error, code, detail? }` with codes `ai_not_configured` (503), `ai_upstream` / `ai_network` (502), `ai_parse` (422), `ai_validation` (4xx/500).

---

## Google Fit Integration

OAuth2 scopes: `fitness.activity.read`, `fitness.sleep.read`.

- Daily: steps, active calories, sleep  
- Sessions: filtered (5–300 min; excludes sleep/still/vehicle)  
- Sync: `/api/sync/google-fit` + session list in Workout tab  

---

## MCP Server (`mcp-server/`)

Stdio · `sql.js` WASM · reads local DB.

| Tool | Description |
|---|---|
| `get_fitness_summary` | Last N days metrics |
| `get_exercise_history` | Sets by exercise (band labels) |
| `get_weekly_summary` | Week aggregates |
| `get_overload_report` | Volume trend by exercise |
| `get_mesocycle_status` | Current block, week, deload flag |

Build: `cd mcp-server && npm run build` — configure path in `~/.cursor/mcp.json`.

---

## Layouts & Pages

| Path | Layout | Content |
|---|---|---|
| `/` | `Layout.astro` | `Dashboard` + `InstallPrompt` |
| `/weight` | `AppLayout.astro` | SSR weight chart + `BottomNav` |

---

## PWA

- Manifest: `public/manifest.webmanifest`  
- SW: `public/sw.js` (cache-first, skips `/api/`)  
- Icons: `public/icons/`  
- `InstallPrompt.tsx` on home  

---

## Scripts

```bash
npm run dev          # http://localhost:4321
npm run build        # Vercel production build
npm test             # Vitest (src/lib)
npm run test:e2e     # Playwright

npm run db:generate  # Drizzle migration diff
npm run db:migrate   # Apply pending migrations (drizzle-kit)
npm run db:baseline  # One-time: sync __drizzle_migrations on existing DB
npm run db:migrate:legacy  # Idempotent SQL runner (Docker startup)
npm run db:push      # Push schema (dev only)
npm run db:studio    # Drizzle Studio

docker compose up --build
cd mcp-server && npm run build
```

---

## Infrastructure

- **Vercel:** `@astrojs/vercel`, region `fra1`  
- **Docker:** `astro.config.docker.mjs`, DB at `file:/data/bws.db`, migrate on start  
- **Turso:** production LibSQL  

Env vars: see `README.md` and `.env.example`.

---

## Completed Phases

- [x] **Phase 1–11** — Foundation through Google Fit (see git history)
- [x] **Phase 12** — Auto-regulation Rule A/B, target hints
- [x] **Phase 13** — Consistency heatmap + streak
- [x] **Phase 14** — AI Coach (`WeeklyCheckIn`)
- [x] **Phase 15** — Turso + Vercel production
- [x] **Phase 16** — CNS deload (~12.5%), 56-day lookback, server set validation, Player partial-session DELETE
- [x] **Phase 17** — Mesocycle table, Block 1/2 swaps, deload week 8 (volume + load)
- [x] **Phase 18** — Differentiated load jumps (+1 kg isolation / +2.5 kg compound)
- [x] **Phase 19** — Band exercises (levels 1–3), `formatExerciseLoad`, band progression
- [x] **Phase 20** — Macro targets from body weight (`macroTargets.ts`), dynamic Diet + Profile TDEE
- [x] **Phase 21** — UX: Stats tab, `DailyActionHero`, onboarding, pull-to-refresh, quit confirm, WorkoutPlayer enhancements, exercise library, goal forecaster, photo vault
- [x] **Phase 22** — Sport polish: Previous/Target band labels, deload volume in logger + AI player path
- [x] **Phase 23** — Product batch: heatmap from goals, onboarding TDEE, AI weekly plan, optional auth, CSV export, i18n, theme, RPE, superset, CI, MCP mesocycle tool
- [x] **Phase 24** — Hardening: log/image validation, rate limits, forecast stagnant rule, Player warmup/MED, swap warnings, `WorkoutPlayerProvider`, API auth on forecast/exercises
- [x] **Phase 25** — Exercise library pagination (`limit`/`offset`/`category`), migration `0004`, Drizzle baseline scripts

---

*Last updated: 2026-05-29 (SPECS refresh)*
