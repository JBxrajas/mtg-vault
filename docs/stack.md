# Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Types shared across API, web and desktop |
| Web | Vite + React + TanStack Router and Query | Pure SPA, reusable in Electron |
| API | Hono | Runs on Vercel Functions and on plain Node |
| DB | PostgreSQL on Neon | Serverless, free tier, Vercel integration; `pg_trgm` for name search and JSONB for raw Scryfall data |
| ORM | Drizzle | Lightweight, clear migrations |
| Validation | Zod (`packages/shared`) | Same schemas in every layer |
| Auth | Better Auth (email and password) | Lives in our own DB, no external service |
| Jobs | GitHub Actions (cron) | No timeout limit; free |
| Desktop | Electron (later phase) | Reuses the web build |
| Monorepo | pnpm workspaces | Simple |

## Structure

```
apps/api        Hono
apps/web        Vite + React
apps/desktop    Electron
packages/shared Zod, types, utilities
packages/db     Drizzle schema and migrations (postgres.js driver)
```

## Deployment

- **Web and API:** Vercel (two projects or one with routes; decided in phase 1).
- **DB:** Neon (native Vercel integration).
- **Scryfall import and price snapshots:** GitHub Actions with cron, writing directly to Neon. Vercel functions have time limits and the Scryfall bulk file is hundreds of MB.
- **Vercel Cron:** lightweight tasks only (for example, price alerts).

## Tooling and versions

- Node.js 22 LTS and pnpm 9 (pinned in the root `package.json` via `packageManager`).
- Web: React 19, Vite, TanStack Router (hash history) and Query.
- API: Hono served locally with `@hono/node-server` and `tsx`.
- CI (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile`, `pnpm typecheck` and the web build on every PR and push to `main`.

## Electron

- The web app must remain an SPA without SSR.
- Auth must work with both cookies and Bearer tokens so web and Electron can share the API.
- Offline mode (local SQLite) is out of scope initially.
