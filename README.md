# mtg-vault

A platform to track and manage Magic: The Gathering collections (Moxfield-style): add and remove cards, price history and, later, card scanning with a camera.

## Status

Phase 1 — monorepo skeleton and knowledge base. See [docs/plan.md](docs/plan.md).

## Stack

TypeScript everywhere · Vite + React (web) · Hono (API) · Postgres on Neon · Drizzle · Zod · Better Auth · Vercel · GitHub Actions for jobs · Electron (later phase).

Details and rationale in [docs/stack.md](docs/stack.md) and [docs/adr/](docs/adr/).

## Structure

```
apps/api        Hono API (Vercel Functions)
apps/web        Vite + React SPA (Vercel)
apps/desktop    Electron (later phase)
packages/shared Shared Zod schemas and types
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
pnpm dev:api                          # API on http://localhost:3001 (GET /health)
pnpm --filter @mtg-vault/web dev      # web on http://localhost:5173
pnpm typecheck                        # typecheck every package
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
