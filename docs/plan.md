# Phased plan

Status: ☐ pending · ◐ in progress · ☑ done

## Phase 1 — Skeleton and knowledge base ◐
- ☑ pnpm monorepo (`apps/api`, `apps/web`, `apps/desktop`, `packages/shared`)
- ☑ Knowledge base and ADRs
- ☐ `apps/web` with Vite + React + TanStack Router/Query
- ☐ Vercel projects (web and API) and Neon database
- ☑ Branch, commit and release process (release-please, Conventional Commits) — see [releases.md](releases.md)
- ☑ GitHub settings and `main` protection — see [releases.md](releases.md)
- ☐ Basic CI (typecheck) on GitHub Actions — needs `pnpm-lock.yaml`, so after Node and pnpm are installed

## Phase 2 — Catalog ☐
- Drizzle schema: `set`, `card` (oracle), `printing`
- GitHub Actions job: import Scryfall bulk data into Neon
- Name search endpoint (`pg_trgm`) and basic filters

## Phase 3 — Collection and users ☐
- Auth with email and password (Better Auth)
- Collections and decks; add, remove and edit entries (quantity, foil, condition, language, purchase price)
- CSV import and export (Moxfield, Deckbox, Manabox)

## Phase 4 — Prices ☐
- Daily job: price snapshots in the `price_snapshot` table
- Price history charts and total collection value
- Price rise and drop alerts

## Phase 5 — Scanning ☐
- Photo upload with OCR (name and collector number) and fuzzy lookup on Scryfall
- Live camera and perceptual hashing (pHash) against Scryfall images to tell printings apart

## Phase 6 — Electron and extras ☐
- `apps/desktop` with Electron loading the `apps/web` build
- Deck builder with per-format validation, statistics, wishlist, public lists
