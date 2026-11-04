# Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Types shared across API, web and desktop |
| Web | Vite + React + TanStack Router and Query | Pure SPA, reusable in Electron |
| API | Hono | Runs on Vercel Functions and on plain Node |
| DB | PostgreSQL on Neon ([setup](neon.md)) | Serverless, free tier, Vercel integration; `pg_trgm` for name search and JSONB for raw Scryfall data |
| ORM | Drizzle | Lightweight, clear migrations |
| Validation | Zod (`packages/shared`) | Same schemas in every layer |
| Auth | Better Auth (username and password, Bearer tokens; [ADR 0008](adr/0008-users-collection-binders-decks.md), [ADR 0009](adr/0009-username-login-with-bearer-tokens.md)) | Lives in our own DB, no external service |
| Jobs | GitHub Actions (cron) | No timeout limit; free |
| Desktop | Electron (later phase) | Reuses the web build |
| Monorepo | pnpm workspaces | Simple |

## Structure

```
apps/api        Hono
apps/web        Vite + React
apps/desktop    Electron
apps/jobs       Batch jobs run by GitHub Actions (Scryfall import)
packages/shared Zod, types, utilities
packages/db     Drizzle schema and migrations (postgres.js driver)
```

## Deployment

- **Web and API:** Vercel ([setup](vercel.md)); the web project exists, the API project comes later.
- **DB:** Neon (native Vercel integration).
- **Scryfall import and price snapshots:** GitHub Actions with cron, writing directly to Neon. Vercel functions have time limits and the Scryfall bulk file is hundreds of MB.
- **Vercel Cron:** lightweight tasks only (for example, price alerts).

## Tooling and versions

- Node.js 22 LTS and pnpm 9 (pinned in the root `package.json` via `packageManager`).
- Web: React 19, Vite, TanStack Router (hash history) and Query.
- API: Hono served locally with `@hono/node-server` and `tsx`.
- Tests: Vitest, run from the root with `pnpm test`. Unit tests live next to the code as `*.test.ts` and must not need a database or network: mock `./cards.js` or other I/O modules (see `apps/api/src/app.test.ts`).
- CI (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile`, `pnpm typecheck` and the web build in the `typecheck` job, and `pnpm test` in a separate `test` job, on every PR and push to `main`.

## Electron

- The web app must remain an SPA without SSR.
- Auth must work with both cookies and Bearer tokens so web and Electron can share the API.
- Offline mode (local SQLite) is out of scope initially.
