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

## Design

Mobile first. One stylesheet (`src/styles.css`) with design tokens as CSS variables: a light palette by default and a dark one that follows the system (`prefers-color-scheme`). The frame is `src/Layout.tsx`: brand and account in a top bar, and the main navigation as a **bottom tab bar on phones** and inline in the top bar from 720 px up. Search results are a card-image grid (2 columns on a phone, more on wide screens); the card dialog is a full-height bottom sheet on phones and a centered modal on wide screens; buttons and fields are at least 44 px tall for touch. Mana costs are drawn as coloured pips by `src/ManaCost.tsx`, and the colour filter uses the same colours. Do not put `backdrop-filter` on the top bar: it makes the fixed bottom navigation position itself relative to the bar instead of the screen.

The first version of this design was checked with screenshots from headless Chromium (390×844 phone and 1280×800 desktop, light and dark) of search, the card dialog, the collection and the sign-in page. Real devices and browsers other than Chromium have not been tried.

## Tests

`pnpm test` from the repository root. Pure logic (`api.ts`, `auth.ts`, `collectionApi.ts`, `format.ts`) is tested in Node. **Components** (`*.test.tsx`) run in jsdom with Testing Library and `userEvent`: the file starts with `// @vitest-environment jsdom`, the API modules (`./api`, `./auth`, `./collectionApi`) are mocked with `vi.mock`, and `renderPage` in `src/test-utils.tsx` renders a page inside a query client and an in-memory router (other routes render a `route: <path>` marker so tests can assert a navigation). The same file has builders (`aCard`, `aPrinting`, `aStack`, `aUser`). They cover the search (debounce, filters, empty and error states, the printings dialog), sign in and account creation (validation, server errors, redirect), the header, the add-to-collection form and the collection page (totals, quantity, removal, refused changes). Query by role or label like a user would, not by CSS class. What they cannot show is layout and styling: that still needs eyes on a browser.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` in dev, `https://mtg-vault-api.vercel.app` in a production build | Base URL of the API, read at build time |

For local development run the API too (`pnpm dev:api`) and the web dev server; the API allows `http://localhost:5173` by default. The deployed API only allows the origins in its `CORS_ORIGINS`, so a production build served from another domain needs that variable updated (see [docs/vercel.md](../../docs/vercel.md)).

## Current state

The home page is a card search: a name box (debounced, 2 characters minimum), a type filter and color-identity toggles, with a card thumbnail per result (click it to open a dialog with the card and **every printing**: set name and code, collector number, year, rarity, finishes and the latest price; click a printing to see its image), backed by `GET /cards/search` ([apps/api](../api/README.md)). The fetch layer is in `src/api.ts` (unit tested); the page is `src/SearchPage.tsx`. Every screen has component tests (see **Tests** below); nothing here has been checked in a real browser by automation. Images are hotlinked from Scryfall with lazy loading and the page shows the credit Scryfall asks for. A **Sign in / Create account** screen (`#/login`) uses a username and a password; the session token is kept in `localStorage` and the header shows who is signed in (`src/auth.ts`, unit tested). Opening a card shows an **Add to collection** form for the selected printing (finish limited to what that printing offers, condition, quantity) when signed in. **My collection** (`#/collection`) lists your stacks with image, set, finish, condition, market price and line total, a header with copies, stacks and total market value (copies without a price are counted separately), `+` / `−` to change the quantity and Remove (`src/collectionApi.ts`, unit tested). Binders and decks come later (see [docs/plan.md](../../docs/plan.md)).
