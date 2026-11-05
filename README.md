# mtg-vault

A platform to track and manage Magic: The Gathering collections (Moxfield-style): add and remove cards, price history and, later, card scanning with a camera.

## Status

Phases 1 to 3 are largely done: the monorepo, CI, the catalog imported from Scryfall into Neon, card search, accounts, the collection (with CSV import and export), decks (with deck list import and export), an interface in English and Spanish, and a personal look (mode, color or card art). The web app and the API run on Vercel with the database on Neon. Next: deck analysis (mana curve, building guides, format rules), filters, binders, then price history. See [docs/plan.md](docs/plan.md) for what is done and what is pending.

## What it does

- **Accounts** with a username and a password ([ADR 0009](docs/adr/0009-username-login-with-bearer-tokens.md)).
- **One collection per user**: an inventory that tells printings apart (set, collector number), finish (nonfoil, foil, etched), condition and language, with market value. Add, change and remove stacks; **CSV import** of a Moxfield export and **CSV export** in the same layout.
- **Decks**: many per user, each with a format (Standard, Modern, Commander, …), boards (main, sideboard, maybeboard, commander), cards divided by type, deck size, and a badge that says how many copies you own. **Import and export** as a text list. Format rules (copy limits, legality) are not enforced yet.
- **Card search** over the whole Scryfall catalog, tolerant of typos, with every printing and its price.
- **Appearance**: light or dark mode, a background color, or the art of any card (and any of its printings), saved on the device.
- **English and Spanish** interface ([ADR 0010](docs/adr/0010-interface-languages.md)).
- Planned: binders (sub-collections), deck analysis and guides, filters, price history, camera scanning and a desktop app.

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
pnpm test                             # unit and component tests (Vitest)
pnpm test:e2e                         # layout checks in a real browser (Playwright)
pnpm test:coverage                    # coverage report
```

## Documentation

- [docs/README.md](docs/README.md) — knowledge base index
- [docs/plan.md](docs/plan.md) — phased plan
- [docs/stack.md](docs/stack.md) — stack and deployment
- [docs/apis.md](docs/apis.md) — external APIs (Scryfall, MTGJSON, …)
- [docs/glossary.md](docs/glossary.md) — MTG and data model glossary
- [docs/releases.md](docs/releases.md) — branches, versioning and releases
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow and rules

All documentation, code, comments and commit messages are written in English. The interface is available in English and Spanish ([ADR 0010](docs/adr/0010-interface-languages.md)).
