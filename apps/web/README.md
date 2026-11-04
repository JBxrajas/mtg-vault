# apps/web

SPA built with Vite + React + TanStack Router and Query.

It must remain a pure SPA (no SSR) so that `apps/desktop` can load the same build. See [ADR 0002](../../docs/adr/0002-spa-for-electron-reuse.md).

- Assets use relative paths (`base: "./"`) and routing uses hash history, so the build also works from `file://` in Electron.
- The UI is in English and Spanish ([ADR 0010](../../docs/adr/0010-interface-languages.md)); see **Languages** below.

## Scripts

```bash
pnpm --filter @mtg-vault/web dev        # dev server on http://localhost:5173
pnpm --filter @mtg-vault/web build      # typecheck and production build into dist/
pnpm --filter @mtg-vault/web typecheck
```

## Design

Mobile first. One stylesheet (`src/styles.css`) with design tokens as CSS variables: a light palette by default and a dark one that follows the system (`prefers-color-scheme`). The frame is `src/Layout.tsx`: brand and account in a top bar, and the main navigation as a **bottom tab bar on phones** and inline in the top bar from 720 px up. Search results are a card-image grid (2 columns on a phone, more on wide screens); the card dialog is a full-height bottom sheet on phones and a centered modal on wide screens; buttons and fields are at least 44 px tall for touch. Mana costs are drawn as coloured pips by `src/ManaCost.tsx`, and the colour filter uses the same colours. Do not put `backdrop-filter` on the top bar: it makes the fixed bottom navigation position itself relative to the bar instead of the screen.

The first version of this design was checked with screenshots from headless Chromium (390×844 phone and 1280×800 desktop, light and dark) of search, the card dialog, the collection and the sign-in page. A script that opens every view at 320, 360, 390, 430, 768 and 1280 px and compares `scrollWidth` with the viewport found one real overflow (the add-card row on the deck page, an input without `min-width: 0`), now fixed; after that no view overflows horizontally. That script is not part of the test suite. Real devices and browsers other than Chromium have not been tried.

## Onboarding and help

Visitors who are not signed in see a **welcome panel** on the search page (`src/Welcome.tsx`: what an account is for, with *Create a free account* and *Sign in*), and *My collection* and *My decks* show a short pitch with the same button instead of a bare "sign in" line. *Create a free account* links to `#/login?mode=register`, which opens the form on account creation (the `mode` search param is validated in `src/router.tsx`). The nav links and the header *Sign in* button have native `title` hints.

Basic terms have a **help bubble** (`src/Tip.tsx`, a small "?" button): search and its filters, finish / condition / quantity in the add form, stacks and market value in the collection, the deck format and the deck boards. It opens on hover, keyboard focus-and-Enter or tap (a plain `title` never shows on phones), closes with Escape, a tap elsewhere or when the mouse leaves, is announced through `role="tooltip"` and `aria-describedby`, and is shifted back inside the screen when it would be clipped. Put a `Tip` next to a label, never inside a `<label>`: a button inside a label takes over the field's association. Checked in headless Chromium at 390 px and 1100 px (no horizontal overflow, bubbles inside the screen); not tried on a real phone.

### Sign-in and sign-up errors

`src/LoginPage.tsx` checks the whole form at once and shows each message **under its own field** (red border, `aria-invalid`, linked with `aria-describedby`); fixing a field clears only its error. The rules are always visible under the fields, the page says that no email is needed, and an `@` in the username gets "Use a username, not an email". A taken username from the server is shown under the username field; other server errors (for example a wrong password) stay as one message above the button. The messages for the username and password rules live in `packages/shared` (`usernameSchema`, `passwordSchema`).

### Search filters

The type filter lists the common card types as chips (Creature, Instant, Sorcery, Artifact, Enchantment, Planeswalker, Land, Battle; tap again to clear) and still accepts any word of the type line (goblin, equipment, legendary). The color buttons show the color name under each pip and a sentence saying what is being filtered, for example "Cards that have all of: Red and Green." With several colors a card must have all of them (`color_identity @> …` in the API); picking none returns every color, including lands and colorless cards.

### Session and cached data

The session token lives in `localStorage` (`src/auth.ts`), but React Query also caches what the API returned (collection, decks…). `refreshSession` in `src/session.ts` runs after every sign-in, account creation and sign-out: it drops every cached query that is not public (the card search stays) and re-reads who is signed in. Without it, signing out left the previous collection on screen, and the next person to sign in would briefly see it. *My collection* and *My decks* also show nothing from the cache when there is no signed-in user. Any new account-bound query key must not start with `cards` or `me`.

### Quantity buttons

`+` and `−` on *My collection* are **optimistic** (`src/CollectionPage.tsx`): the number and the totals change on tap and the request follows. Requests of the same list run one after another (mutation `scope`), so quick taps cannot reach the server out of order, and the buttons stay enabled meanwhile. When the server refuses a change (for example copies placed in binders) the old number comes back with the message. The list is re-read once, after the last request ends, instead of after every tap.

## Languages

English is the source and the fallback; Spanish is a translation. Every UI message is a key in `src/messages/en.ts` with its Spanish text in `src/messages/es.ts`, and the build fails if a key is missing in Spanish. Use `const { t } = useI18n()` in components (they re-render when the language changes) and `t(key, vars)` elsewhere: `{name}` placeholders, `{ one, other }` for plurals (the key takes `count`). The start language is the saved choice (`localStorage` `mtg-vault.locale`), else the browser's, else English; the **EN / ES button** in the top bar and the *Language* section of *Appearance* change it, and `<html lang>` follows. Prices use the language's number format. Card names and type lines are English data from Scryfall and are not translated, so the type filter still sends English words; errors that come from the server are shown as received, except the sign-in and sign-up ones we know (`serverMessage` in `src/LoginPage.tsx`). Tests start in English whatever the machine's language (`test-setup.ts`); `i18n.test.ts` checks that both catalogs have the same keys, placeholders and plural shape, and `i18n-pages.test.tsx` renders screens in Spanish. Why this and not Lingui: [ADR 0010](../../docs/adr/0010-interface-languages.md).

## Deck and collection import and export

- **Collection**: an *Export CSV* button on *My collection* downloads the stacks in the layout the import reads (`collectionToCsv`, with a byte-order mark so Excel reads accents).
- **Decks**: *My decks* has an *Import a deck* panel (name, format, paste a list or choose a `.txt`; the name is taken from the file name when empty) that creates the deck and imports the list; with nothing to report it opens the deck, otherwise it stays to show the cards that were not found. A deck page has an *Import / export list* panel: *Copy list*, *Download .txt* (named after the deck) and an import into that deck. The count in the list sets the copies, so importing the same list twice changes nothing. The list format and what was tested are in [docs/apis.md](../../docs/apis.md#deck-lists-text-import-and-export); the endpoint is in [apps/api](../api/README.md).
- Reading and writing the formats (`parseDeckList`, `formatDeckList`, `collectionToCsv`, `toCsv`) is in `packages/shared`; `src/download.ts` hands a file to the browser; `src/DeckListInput.tsx` is the text box with preview, `src/DeckListTools.tsx` and `src/ImportDeck.tsx` the two panels.
- Messages that come back from the server about a list (for example "No card found") are English.

## Appearance

The palette icon in the top bar opens `#/appearance` (`src/AppearancePage.tsx`): **mode** (automatic, light or dark), a **background color** (a tint named after the five Magic colors, plus gold and neutral, mixed into the neutral background of the current mode with `color-mix`) or the **art of any card** found by name, with a *Dimming* slider (50 to 95 %) for how much the page color covers the art. The choice applies at once and is saved **on this device only** in `localStorage` (`src/appearance.ts`: parsing, validation, `setAppearance`, `useAppearance`); it is applied before the first render to avoid a flash. Mechanically it sets `data-theme`, `data-bg` and `data-art` on `<html>` and the `--art-url` / `--art-scrim` variables that `src/styles.css` reads; the art is a fixed `body::before` layer covered by a `body::after` layer in the page color.

After choosing a card, a *Printing* section lists its other printings by art (printings that share a picture appear once, under the first) so a different artwork can be picked; the card's id is kept with the choice for that (`oracleId` in `Art`, only accepted when it is a UUID). The art URL ends up inside CSS, so only `https://cards.scryfall.io/…` addresses made of safe characters are accepted, both when picking and when reading what was stored (`isArtUrl`). Not done yet: saving the choice in the account so it follows the user across devices, and showing the artist's name for the chosen art.

## Tests

`pnpm test` from the repository root. Pure logic (`api.ts`, `auth.ts`, `collectionApi.ts`, `format.ts`) is tested in Node. **Components** (`*.test.tsx`) run in jsdom with Testing Library and `userEvent`: the file starts with `// @vitest-environment jsdom`, the API modules (`./api`, `./auth`, `./collectionApi`) are mocked with `vi.mock`, and `renderPage` in `src/test-utils.tsx` renders a page inside a query client and an in-memory router (other routes render a `route: <path>` marker so tests can assert a navigation). The same file has builders (`aCard`, `aPrinting`, `aStack`, `aUser`). They cover the help bubble (`Tip`), the welcome panel, the search (debounce, filters, empty and error states, the printings dialog), sign in and account creation (validation, server errors, redirect), the header, the add-to-collection form and the collection page (totals, quantity, removal, refused changes). Query by role or label like a user would, not by CSS class. What they cannot show is layout and styling: that still needs eyes on a browser.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` in dev, `https://mtg-vault-api.vercel.app` in a production build | Base URL of the API, read at build time |

For local development run the API too (`pnpm dev:api`) and the web dev server; the API allows `http://localhost:5173` by default. The deployed API only allows the origins in its `CORS_ORIGINS`, so a production build served from another domain needs that variable updated (see [docs/vercel.md](../../docs/vercel.md)).

## Current state

The home page is a card search: a name box (debounced, 2 characters minimum), a type filter and color-identity toggles, with a card thumbnail per result (click it to open a dialog with the card and **every printing**: set name and code, collector number, year, rarity, finishes and the latest price; click a printing to see its image), backed by `GET /cards/search` ([apps/api](../api/README.md)). The fetch layer is in `src/api.ts` (unit tested); the page is `src/SearchPage.tsx`. Every screen has component tests (see **Tests** below); nothing here has been checked in a real browser by automation. Images are hotlinked from Scryfall with lazy loading and the page shows the credit Scryfall asks for. A **Sign in / Create account** screen (`#/login`) uses a username and a password; the session token is kept in `localStorage` and the header shows who is signed in (`src/auth.ts`, unit tested). Opening a card shows an **Add to collection** form for the selected printing (finish limited to what that printing offers, condition, quantity) when signed in. **My collection** (`#/collection`) lists your stacks with image, set, finish, condition, market price and line total, a header with copies, stacks and total market value (copies without a price are counted separately), `+` / `−` to change the quantity and Remove (`src/collectionApi.ts`, unit tested). **Import from CSV** (a panel at the top of *My collection*, `src/ImportCollection.tsx`): choose a CSV exported from Moxfield, see how many lines and cards it holds, which lines cannot be read and which columns are ignored, then import. It reports how many stacks were created, updated or already up to date, and lists the lines imported with a change and the ones that could not be imported. Large files are sent in chunks with a progress count. The count in the file sets the quantity of each stack, so importing the same file again changes nothing. **My decks** (`#/decks`) lists decks with format and progress towards the format's size, and creates a new one. Opening a deck (`#/decks/<id>`) shows its main board **divided by card type** (Commander, Planeswalker, Creature, Sorcery, Instant, Artifact, Enchantment, Battle, Land) with a count per group, tabs for sideboard and maybeboard, a quantity stepper per card, an *Owned / Own 1/4* badge from your collection, a search box to add cards to a chosen board (the commander board only for Commander, Brawl and Oathbreaker) and a settings panel (name, format, public, delete with confirmation) (`src/DecksPage.tsx`, `src/DeckPage.tsx`, `src/decksApi.ts`). Binders come later (see [docs/plan.md](../../docs/plan.md)).
