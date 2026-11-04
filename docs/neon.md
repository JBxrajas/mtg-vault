# Neon

Neon hosts the Postgres database and is the candidate auth provider (see [auth](#auth-open-decision)).

## Setup (done)

| Item | Value |
|---|---|
| Project | `frosty-boat-23676668` |
| Org | `org-plain-shape-13233811` |
| Default branch | `production` |
| Services declared in `neon.ts` | Neon Auth (`auth: true`); Postgres is always present |

Steps taken, from the repo root with the Neon CLI (`npm i -g neon@latest`):

```bash
neon login            # browser sign-in
neon init -y --org-id <org> --project-id <project> --branch production --services postgres,auth
neon deploy           # provisions the services and pulls env vars into .env.local
```

- `neon init` fails in a pnpm workspace unless the dependencies are added to the root first: `pnpm add -w -D @neon/config @neon/env`. Then run it again.
- `neon init` links the project in `.neon` (git-ignored) and writes `neon.ts` (committed).
- `neon init` also writes agent configuration outside the repo (`~/.copilot/mcp-config.json`), and agent skills to `.claude/skills/` plus `skills-lock.json`.

## Environment variables

`neon deploy` writes them to `.env.local` (git-ignored; never commit it). To refresh: `neon env pull`.

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Pooled connection; API and `packages/db` |
| `DATABASE_URL_UNPOOLED` | Direct connection; migrations (`drizzle-kit migrate`) |
| `NEON_BRANCH` | Current Neon branch name |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` | Neon Auth endpoints |

For GitHub Actions jobs, store `DATABASE_URL` as a repository secret: `gh secret set DATABASE_URL -R JBxrajas/mtg-vault`.

## Branches

`neon.ts` gives new non-default branches a 7-day TTL. Create one with `neon checkout <name>`; `production` is untouched.

## Auth

**Decision:** self-managed Better Auth in our own API, as in [ADR 0004](adr/0004-hono-api-and-better-auth.md). It keeps full plugin freedom (OAuth providers, API keys, Bearer tokens for Electron) and does not tie login to Neon's managed plugin set. Better Auth stores its tables in the same Neon Postgres, through Drizzle, with username and password sign-in ([ADR 0008](adr/0008-users-collection-binders-decks.md)).

Neon also offers Managed Better Auth (`auth: true` in `neon.ts`, tables in the `neon_auth` schema). It was provisioned during setup but is **not used** and no code depends on it. We can remove `auth: true` from `neon.ts` and run `neon deploy` to deprovision it; that is not done yet, so check with `neon neon-auth status` before relying on a clean state.

## Storage

The free plan includes 0.5 GB per project. The database was at 475 MB on 2026-11-04 because the first imports rewrote every row; the importer now skips unchanged rows. See "Storage" in [apps/jobs/README.md](../apps/jobs/README.md) for the one-off `VACUUM FULL`. Check usage with the Neon console or `select pg_size_pretty(pg_database_size(current_database()))`.

## Status

Neon is connected and the services are provisioned. Drizzle migration `0000_init` is applied to the `production` branch (use `DATABASE_URL_UNPOOLED` for `pnpm --filter @mtg-vault/db migrate`). The tables are empty until the Scryfall import job exists.
