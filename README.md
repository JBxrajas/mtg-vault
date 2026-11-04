# mtg-vault

A platform to track and manage Magic: The Gathering collections (Moxfield-style): add and remove cards, price history and, later, card scanning with a camera.

## Status

Phases 1 and 2 are done: the monorepo, CI, the catalog imported from Scryfall into Neon, and a card search (API and web) deployed on Vercel. Phase 3, users, collection and decks, has its data model defined and documented ([ADR 0008](docs/adr/0008-users-collection-binders-decks.md)); the API and screens for it are next. See [docs/plan.md](docs/plan.md).

## What it will do

- **Accounts** with a username and a password (implemented; live in production once the API has its auth secrets, see docs/vercel.md).
- **One collection per user** (add, change and remove cards works today), as an inventory that tells printings apart (set, collector number), finish (nonfoil, foil, etched), condition and language, with purchase price and notes.
- **Binders**: named sub-collections of the collection (a physical binder, a box, a trade list).
- **Decks**, many per user, each with a format (Standard, Modern, Commander, …) and its cards divided by type: creature, sorcery, instant, enchantment, artifact, and so on.
- **Card search** over the whole Scryfall catalog, tolerant of typos (works today).
- Later: price history, CSV import and export, camera scanning and a desktop app.

## Stack

TypeScript everywhere · Vite + React (web) · Hono (API) · Postgres on Neon · Drizzle · Zod · Better Auth · Vercel · GitHub Actions for jobs · Electron (later phase).

Details and rationale in [docs/stack.md](docs/stack.md) and [docs/adr/](docs/adr/).

## Structure

```
apps/api        Hono API (Vercel Functions)
apps/web        Vite + React SPA (Vercel)
apps/jobs       Scryfall import (GitHub Actions)
apps/desktop    Electron (later phase)
packages/shared Shared Zod schemas, types and deck helpers
packages/db     Drizzle schema and migrations
docs/           Knowledge base, ADRs and plan
.github/        CI and scheduled jobs (import and prices)
```

## Requirements

- Node.js 22 LTS
- pnpm 9+

Recommended setup on Linux/macOS: install [fnm](https://github.com/Schniz/fnm), then:

```bash
fnm install 22
corepack enable   # activates the pnpm version pinned in package.json
```

Run the project:

```bash
pnpm install
pnpm dev:api                          # API on http://localhost:3001 (/health, /cards/search)
pnpm --filter @mtg-vault/web dev      # web on http://localhost:5173
pnpm typecheck                        # typecheck every package
pnpm test                             # unit tests (Vitest)
```

## Documentation

- [docs/README.md](docs/README.md) — knowledge base index
- [docs/plan.md](docs/plan.md) — phased plan
- [docs/stack.md](docs/stack.md) — stack and deployment
- [docs/apis.md](docs/apis.md) — external APIs (Scryfall, MTGJSON, …)
- [docs/glossary.md](docs/glossary.md) — MTG and data model glossary
- [docs/releases.md](docs/releases.md) — branches, versioning and releases
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow and rules

All documentation, code, comments and UI text are written in English.
