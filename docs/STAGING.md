# Staging environment

Use a **separate Turso database** and Vercel preview deployment so production data stays untouched.

## Turso staging branch

```bash
turso db create bws-tracker-staging
turso db tokens create bws-tracker-staging
```

Set on Vercel **Preview** environment:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `libsql://bws-tracker-staging-….turso.io` |
| `DATABASE_AUTH_TOKEN` | staging token |
| `BWS_AUTH_SECRET` | unique staging secret |
| `BWS_LOGIN_PASSWORD` | staging-only password |

Copy other vars from production (Google OAuth redirect can use preview URL).

## Deploy

```bash
git push origin feature-branch
```

Vercel creates a preview URL. Run migrations against staging:

```bash
DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run db:migrate

If `db:migrate` fails on an already-provisioned DB (empty `__drizzle_migrations`), run `npm run db:baseline` once, then `db:migrate` again. For idempotent SQL apply, `npm run db:migrate:legacy` is also available.
```

## Local

Use `file:./bws-staging.db` in `.env.local` for isolated testing.
