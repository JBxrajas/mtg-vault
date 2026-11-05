# Phased plan

Status: ☐ pending · ◐ in progress · ☑ done

## Phase 1 — Skeleton and knowledge base ◐
- ☑ pnpm monorepo (`apps/api`, `apps/web`, `apps/desktop`, `packages/shared`)
- ☑ Knowledge base and ADRs
- ☑ `apps/web` with Vite + React + TanStack Router/Query (home page is now the card search)
- ☑ Vercel projects (web and API) and Neon database (Neon: [neon.md](neon.md); web and API live on Vercel: [vercel.md](vercel.md))
- ☑ Production deploys from GitHub Actions only when something changed, and a guard for the Vercel deployment limit ([ADR 0012](adr/0012-deploy-from-github-actions.md), [ADR 0011](adr/0011-vercel-deploy-guard-hook.md))
- ☑ Branch, commit and release process (release-please, Conventional Commits) — see [releases.md](releases.md)
- ☑ Docs check hook before every commit made through Claude Code — see [ADR 0006](adr/0006-docs-check-commit-hook.md)
- ☑ GitHub settings and `main` protection — see [releases.md](releases.md)
- ☑ Basic CI on GitHub Actions: typecheck, unit tests (Vitest) and web build (`.github/workflows/ci.yml`), with `pnpm-lock.yaml` committed
- ☑ `typecheck` is a required check on `main`
- ☑ `test` is a required check on `main` (applied 2026-11-04, see [ADR 0007](adr/0007-tests-before-merge.md))
- ☑ First release `v0.1.0` published; `release-as` removed

## Phase 2 — Catalog ☑
- ☑ Drizzle schema: `sets`, `cards` (oracle), `printings`, `price_snapshots` and migrations (`packages/db`), applied to Neon
- ☑ GitHub Actions job: import Scryfall bulk data into Neon ([apps/jobs](../apps/jobs/README.md); verified end to end in Actions)
- ☑ Name search endpoint (`pg_trgm`) and basic filters ([apps/api](../apps/api/README.md))
- ☑ Card search page in the web app, with card images ([apps/web](../apps/web/README.md))

## Phase 3 — Collection and users ◐
- ☑ Data model: users, one collection per user (inventory with printings, finish, condition, language), binders, decks with formats and type groups ([ADR 0008](adr/0008-users-collection-binders-decks.md)); migration `0002` applied to production
- ☑ Auth with username and password: register, sign in and out, `GET /me`, sign-in screen in the web app ([ADR 0009](adr/0009-username-login-with-bearer-tokens.md)); live in production, verified end to end (see [vercel.md](vercel.md))
- ☑ Inventory: API (`/collection/items`) and screens to add, change and remove stacks, with market value ([apps/api](../apps/api/README.md), [apps/web](../apps/web/README.md))
- ✗ Binders: dropped on 2026-11-04 (decision of the project owner). The `binders` and `binder_items` tables from migration `0002` stay in the database, unused; removing them would be a separate migration, not done
- ☑ Decks: API and screens to build decks with formats, boards, type groups, deck size and an owned/missing badge from the collection ([apps/api](../apps/api/README.md), [apps/web](../apps/web/README.md)). Format rules (size limits, copy limits, legality) are not enforced yet
- ☑ CSV import of a collection (Moxfield layout; other files with similar headers should work) ([apps/api](../apps/api/README.md), [docs/apis.md](apis.md#collection-files-csv-import))
- ☑ Collection CSV export and deck list import and export ([docs/apis.md](apis.md#deck-lists-text-import-and-export)); a CSV export of decks is not done
- ☑ Interface in English and Spanish, with a language button ([ADR 0010](adr/0010-interface-languages.md)); server error messages are still English
- ☑ Appearance: light or dark mode, background color or card art with a choice of printing, saved on the device ([apps/web](../apps/web/README.md))
- ◐ Deck analysis: done for Commander decks (lands against Karsten's formula, mana curve and what it means, ramp / card draw / removal / wipes, format rules as non-blocking warnings, brackets guide, link and side window to EDHREC; [ADR 0013](adr/0013-commander-knowledge-and-analysis.md), [knowledge](knowledge/commander.md)). Commander-first flow (guided start, visual commander chooser with printings, commander validation, problem highlighting, folding groups, enlargeable cards) done. Pending: other formats, colored sources per spell, Game Changers check, archetype guides, cards from your collection that fit a commander
- ◐ Filters: done in the collection (search, sorting, color, type, rarity, finish, condition, set, mana value). Pending: the deck, the card search, and legality

## Phase 4 — Prices ◐
- ◐ Price snapshots in `price_snapshots`: the Scryfall import writes a row when a printing's price changes ([apps/jobs](../apps/jobs/README.md)); latest prices shown per printing in the web app. Runs weekly for now; a daily run needs the storage plan checked first
- ☑ Printings list per card with set name and price (`GET /cards/:oracleId/printings`)
- ☑ Collection prices in Mexican pesos with a rate set by the user
- Price history charts and total collection value
- Price rise and drop alerts

- ☑ High-resolution art page and art view in the collection, with the artist (from Scryfall, on demand)

## Phase 5 — Scanning ◐
Design in [ADR 0014](adr/0014-card-scanning-with-art-fingerprints.md): identify the card by an art fingerprint, on the device, in English, Spanish, Japanese and Russian.
- ✓ Fingerprint, index file format and nearest-match search (`packages/shared`), and the weekly job that builds the index (`apps/jobs`)
- ☐ API route that serves the index with long cache headers
- ☐ Scanner screen: camera with an alignment frame, focus meter from red to green, capture sound, toast with name and price, upload-a-photo fallback
- ☐ Batch session: confirm each card, then add it to the collection or to a deck; whole-deck scanning
- ☐ Measure on the full index with sleeved and foil cards, and tune `matchConfidence`
- ☐ Use the bottom-left line (set, number, language) to pick the exact printing when it can be read

## Phase 6 — Electron and extras ☐
- `apps/desktop` with Electron loading the `apps/web` build
- Wishlist and public deck lists
