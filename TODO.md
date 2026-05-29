# BWS Tracker — TODO

Prioritized backlog. Lucrăm **pe rând** — ia primul item din „Următor”, bifează când e gata.

Legătură: [SPECS.md](./SPECS.md) (arhitectură & formule).

---

## Următor (prioritate)

### Produs & UX

- [ ] **Heatmap din `user_goals`** — `CAL_MIN` / `CAL_MAX` / `STEP_MIN` din țintele userului, nu 1200/1850/10k fixe
- [ ] **Onboarding → TDEE din greutate** — dacă userul introduce kg la onboarding, calculează automat ținte (ca în Profile TDEE)
- [ ] **AI weekly plan + deload** — `generate-weekly-plan` primește `isDeloadWeek` și recomandă mai puține seturi în săptămâna 8
- [ ] **Badge progres benzi** — la Rule A pe bandă, badge „⬆️ +1 level” în loc de „+2.5 kg”
- [ ] **Mesocycle: auto-reset săptămână 8** — opțional: după deload, propune automat „Start Block N” sau reminder

### Tehnic & calitate

- [ ] **Autentificare multi-user** — sesiuni, `USER_ID` din context, nu hardcodat `1`
- [ ] **Migrații Drizzle disciplinate** — `db:generate` + `db:migrate` în CI/deploy; evită doar `db:push` în prod
- [ ] **Rate limiting API** — `/api/workouts`, `/api/ai-coach`, `/api/generate-weekly-plan`, `/api/vision`
- [ ] **Teste `exerciseKind`** — `formatExerciseLoad`, `isBandedExercise` edge cases
- [ ] **E2E smoke** — Playwright: log weight → save workout set → verifică BWS

### Integrări

- [ ] **Google Fit token refresh** — gestionare expirare robustă + mesaj user în Profile
- [ ] **MCP server sync schema** — `mesocycles`, `exercises`, band weights în tool-uri
- [ ] **Export date** — CSV ultimele 90 zile (logs + workouts)

### Infra & docs

- [ ] **`.env.example` complet** — toate variabilele din README + comentarii
- [ ] **README ↔ SPECS** — un singur loc pentru env; README scurt cu link la SPECS
- [ ] **Staging environment** — Turso branch / preview Vercel cu DB separat

---

## În backlog (mai târziu)

- [ ] Notificări PWA (reminder log zilnic / workout day)
- [ ] Istoric mesociclu (block start dates, PR-uri per block)
- [ ] Superset / circuit mode în WorkoutPlayer
- [ ] RPE tracking opțional per set
- [ ] i18n RO/EN
- [ ] Dark/light theme toggle (acum dark implicit)

---

## Gata recent ✅

- [x] CNS deload ~12.5%, lookback 56 zile
- [x] Validare server seturi + DELETE sesiune parțială Player
- [x] Progresie diferențiată (+1 kg izolări / +2.5 kg compuși)
- [x] Benzi Light/Medium/Heavy (1–3), fără kg
- [x] Săptămână deload mesociclu (săpt. 8): volum −40%, încărcări −12%
- [x] Macro ținte din greutate (1.8 g/kg proteină)
- [x] Previous/Target cu `formatExerciseLoad` pentru benzi
- [x] UX: Stats tab, DailyActionHero, onboarding, pull-to-refresh, WorkoutPlayer, library
- [x] SPECS.md + TODO.md (acest fișier)

---

## Cum folosești lista

1. Alege **un** checkbox din „Următor”.
2. Implementează + `npm test` + `npm run build`.
3. Mută itemul în „Gata recent” (sau șterge din Următor).
4. Commit când ceri explicit.

---

*Actualizat: 2026-05-29*
