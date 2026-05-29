# BWS Tracker — TODO

**Status:** All items from the 2026-05-29 backlog are implemented. Use this file for new work only.

See [SPECS.md](./SPECS.md) for architecture.

---

## Gata ✅ (2026-05-29 batch)

### Produs & UX
- [x] Heatmap din `user_goals` (`heatmapThresholdsFromGoals`)
- [x] Onboarding → TDEE din greutate (`calculateTdeeFromWeight`)
- [x] AI weekly plan + deload week (`generate-weekly-plan`)
- [x] Badge progres benzi („⬆️ Medium” etc.)
- [x] Mesocycle: reminder block advance + `block_history` + UI history

### Tehnic
- [x] Auth opțional (`BWS_AUTH_SECRET` + login API)
- [x] CI GitHub Actions (test + build + migration check)
- [x] Rate limiting (`workouts`, `ai-coach`, `generate-weekly-plan`, `vision`)
- [x] Teste `exerciseKind`
- [x] E2E Playwright (existente în `e2e/`)

### Integrări
- [x] Google Fit token refresh (`googleTokenStore`)
- [x] MCP: band labels + `get_mesocycle_status`
- [x] Export CSV `/api/export?days=90`

### Infra & docs
- [x] `.env.example` complet
- [x] `docs/STAGING.md`
- [x] SPECS.md actualizat

### Backlog (fost „mai târziu”)
- [x] Notificări PWA (browser Notification + toggle Profile)
- [x] Istoric mesociclu (`block_history`)
- [x] Superset mode WorkoutPlayer (toggle + rest scurt)
- [x] RPE opțional per set (Player + DB `workout_sets.rpe`)
- [x] i18n RO/EN (nav + preferințe)
- [x] Dark/light theme (`data-theme` + toggle)

---

## Gata ✅ (evaluare critică — gap batch)

- [x] `/api/forecast` + `/api/exercises` cu auth; paginare exercises API
- [x] Validare `/api/logs` (`logValidation.ts`)
- [x] Rate limit `macro-solver`; validare URL imagini exercises
- [x] Race `fetchPrevStats`: generation counter + `AbortController`
- [x] Forecaster: stagnare doar la cut, prag `-0.25 kg/săpt`
- [x] Guard swap Block 2 (`missingBlock2Swaps`) + warning UI Logger
- [x] MED warning (Logger + Player); warmup sets în Player
- [x] `WorkoutPlayerProvider` (fără props drilling Dashboard → Logger)
- [x] Teste: `logValidation`, `workoutSafety`, `missingBlock2Swaps`
- [x] Paginare UI Exercise Library (`limit`/`offset` + filtru categorie)
- [x] Erori AI uniforme (`src/lib/aiApi.ts`)
- [x] Teste API integrare: `workout-set`, `exercises`, `generate-weekly-plan`

---

## Idei viitoare (neplanificate)

- [ ] Înregistrare user nou (signup) + invite
- [ ] Heatmap ținte din `%` deficit față de TDEE
- [ ] Apple Health / Health Connect
- [ ] Offline workout queue

---

*Actualizat: 2026-05-29 (gap batch evaluare)*
