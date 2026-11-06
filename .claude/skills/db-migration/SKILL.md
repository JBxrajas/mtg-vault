---
name: db-migration
description: Change the mtg-vault database schema safely - edit the Drizzle schema, generate the migration, apply it to production Neon BEFORE the API that needs it is deployed, and verify. Use for any change in packages/db/src/schema.ts or when asked to apply or run a migration.
---

# Schema change and migration

Order matters: **the migration must be applied to production before the API that reads the new columns is deployed**, or every query that touches them fails.

## 1. Write it
- Edit `packages/db/src/schema.ts`; prefer nullable or defaulted columns so old code keeps working during the gap.
- `cd packages/db && pnpm generate` creates `migrations/000N_*.sql`. Read the SQL; rename the file to say what it does if the generated name is random. Never edit an applied migration.
- Update the code, tests and docs (`docs/neon.md`, `docs/stack.md`, READMEs). Watch storage: Neon free is 0.5 GB (check size before big columns; ADR 0015).
- Ship the PR with the `ship-pr` skill, but tell the user the merge deploys the API: **apply the migration before merging** when the API reads the new columns, or hold the merge until it is applied.

## 2. Apply to production (only when the user asks or has approved)
`.env.local` holds the URLs and `NEON_BRANCH=production`. Never print its values.
```bash
cd packages/db && set -a && . ../../.env.local && set +a \
  && DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm exec drizzle-kit migrate
```
`drizzle.config` reads `DATABASE_URL`, so it must be set to the **unpooled** URL for migrations.

## 3. Verify (read-only)
Run a script from `packages/db` (it has `postgres`) that checks `information_schema.columns` for the new columns and a count of filled rows. Delete the script afterwards. Do not run destructive SQL on production unless explicitly asked.

## 4. Backfill
New columns are usually filled by the next catalog import (see `catalog-import`). Say so in the report.
