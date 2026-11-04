# apps/web

SPA built with Vite + React + TanStack Router and Query.

It must remain a pure SPA (no SSR) so that `apps/desktop` can load the same build. See [ADR 0002](../../docs/adr/0002-spa-for-electron-reuse.md).

- Assets use relative paths (`base: "./"`) and routing uses hash history, so the build also works from `file://` in Electron.
- All UI text is in English.

## Scripts

```bash
pnpm --filter @mtg-vault/web dev        # dev server on http://localhost:5173
pnpm --filter @mtg-vault/web build      # typecheck and production build into dist/
pnpm --filter @mtg-vault/web typecheck
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` in dev, `https://mtg-vault-api.vercel.app` in a production build | Base URL of the API, read at build time |

For local development run the API too (`pnpm dev:api`) and the web dev server; the API allows `http://localhost:5173` by default. The deployed API only allows the origins in its `CORS_ORIGINS`, so a production build served from another domain needs that variable updated (see [docs/vercel.md](../../docs/vercel.md)).

## Current state

The home page is a card search: a name box (debounced, 2 characters minimum), a type filter and color-identity toggles, backed by `GET /cards/search` ([apps/api](../api/README.md)). The fetch layer is in `src/api.ts` (unit tested); the page is `src/SearchPage.tsx`. There are no component tests yet (no DOM test environment is set up), and the page has not been checked in a browser by automation, only built and typechecked. Collection and auth screens come in later phases (see [docs/plan.md](../../docs/plan.md)).
