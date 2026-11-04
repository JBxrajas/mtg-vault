# Phased plan

Status: ☐ pending · ◐ in progress · ☑ done

## Phase 1 — Skeleton and knowledge base ◐
- ☑ pnpm monorepo (`apps/api`, `apps/web`, `apps/desktop`, `packages/shared`)
- ☑ Knowledge base and ADRs
- ☑ `apps/web` with Vite + React + TanStack Router/Query (home page is now the card search)
- ☑ Vercel projects (web and API) and Neon database (Neon: [neon.md](neon.md); web and API live on Vercel: [vercel.md](vercel.md))
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
- ☑ Card search page in the web app ([apps/web](../apps/web/README.md))

## Phase 3 — Collection and users ◐
- ☑ Data model: users, one collection per user (inventory with printings, finish, condition, language), binders, decks with formats and type groups ([ADR 0008](adr/0008-users-collection-binders-decks.md)); migration `0002` not applied to production yet
- ☐ Auth with username and password (Better Auth username plugin; tables exist, API not wired)
- ☐ API and screens to add, remove and edit inventory stacks, assign copies to binders, and build decks
- CSV import and export (Moxfield, Deckbox, Manabox)

## Phase 4 — Prices ☐
- Daily job: price snapshots in the `price_snapshots` table
- Price history charts and total collection value
- Price rise and drop alerts

## Phase 5 — Scanning ☐
- Photo upload with OCR (name and collector number) and fuzzy lookup on Scryfall
- Live camera and perceptual hashing (pHash) against Scryfall images to tell printings apart

## Phase 6 — Electron and extras ☐
- `apps/desktop` with Electron loading the `apps/web` build
- Deck builder with per-format validation, statistics, wishlist, public lists
