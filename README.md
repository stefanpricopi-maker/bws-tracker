# BWS Tracker

Strict, math-based fitness tracker. Every number has a formula. Every target has a reason.

Built with Astro SSR, React, Tailwind CSS, Drizzle ORM, Turso, and deployed on Vercel.

## Features

- **BWS Score** — composite 0–100 fitness score (weight pace, nutrition, protein, activity)
- **Weight Trend** — 7-day rolling average chart (Recharts)
- **Diet Tracker** — calorie ring, macro bars, active burn eat-back rule
- **Step Tracker** — NEAT burn estimate, progress bar
- **Workout Logger** — 7-day hybrid split, auto-regulation (Rule A/B progressive overload)
- **Google Fit Sync** — steps, active calories, sleep, workout sessions via OAuth2
- **Consistency Heatmap** — 30-day GitHub-style calendar with green streak
- **AI Coach** — weekly LLM analysis via Groq (OpenAI-compatible)
- **MCP Server** — exposes fitness data to Cursor AI via stdio
- **PWA** — installable, offline shell, service worker

## Stack

| | |
|---|---|
| Framework | Astro 5 (SSR) |
| UI | React 19 + Tailwind CSS v4 |
| DB (local) | LibSQL `file:./bws.db` |
| DB (production) | Turso (LibSQL cloud) |
| ORM | Drizzle |
| Deployment | Vercel |
| Docker | Node 22 Alpine + docker-compose |

## Local Development

```bash
npm install
npm run dev          # http://localhost:4321
```

Requires a `.env` file — copy the structure from `.env.example` (or see `SPECS.md`).

## Docker

```bash
docker compose up --build
```

Uses `astro.config.docker.mjs` (Node standalone adapter) and a local SQLite file at `/data/bws.db`.

## Database

```bash
npm run db:push       # Push schema to Turso (production)
npm run db:generate   # Generate migration file from schema diff
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Drizzle Studio GUI
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | `file:./bws.db` locally, `libsql://...turso.io` in production |
| `DATABASE_AUTH_TOKEN` | Turso auth token (not needed for local file) |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth2 callback URL |
| `AI_API_KEY` | Groq / OpenAI API key |
| `AI_API_BASE_URL` | API base URL (default: `https://api.groq.com/openai/v1`) |
| `AI_MODEL` | Model name (default: `llama-3.1-8b-instant`) |

## MCP Server (Cursor Integration)

```bash
cd mcp-server && npm run build
```

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "bws-tracker": {
      "command": "node",
      "args": ["/path/to/bws-tracker/mcp-server/dist/index.js"]
    }
  }
}
```

Tools: `get_fitness_summary`, `get_exercise_history`, `get_weekly_summary`, `get_overload_report`.

## Full Specs

See [SPECS.md](./SPECS.md) for complete phase history, formulas, schema, and API docs.
