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

The home page is a card search: a name box (debounced, 2 characters minimum), a type filter and color-identity toggles, with a card thumbnail per result (click it to open a dialog with the card and **every printing**: set name and code, collector number, year, rarity, finishes and the latest price; click a printing to see its image), backed by `GET /cards/search` ([apps/api](../api/README.md)). The fetch layer is in `src/api.ts` (unit tested); the page is `src/SearchPage.tsx`. There are no component tests yet (no DOM test environment is set up), and the page has not been checked in a browser by automation, only built and typechecked. Images are hotlinked from Scryfall with lazy loading and the page shows the credit Scryfall asks for. A **Sign in / Create account** screen (`#/login`) uses a username and a password; the session token is kept in `localStorage` and the header shows who is signed in (`src/auth.ts`, unit tested). Opening a card shows an **Add to collection** form for the selected printing (finish limited to what that printing offers, condition, quantity) when signed in. **My collection** (`#/collection`) lists your stacks with image, set, finish, condition, market price and line total, a header with copies, stacks and total market value (copies without a price are counted separately), `+` / `−` to change the quantity and Remove (`src/collectionApi.ts`, unit tested). Binders and decks come later (see [docs/plan.md](../../docs/plan.md)).
