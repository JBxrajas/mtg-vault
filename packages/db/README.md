# packages/db

Drizzle ORM schema and migrations for Postgres (Neon in production).

## Tables

| Table | Purpose | Key |
|---|---|---|
| `sets` | Editions | Scryfall set id |
| `cards` | Oracle cards (the card as a concept) | Scryfall `oracle_id` |
| `printings` | A card in a specific set | Scryfall card id; unique per set, collector number and language |
| `price_snapshots` | Daily price of a printing (USD, EUR, TIX; foil and etched) | `(printing_id, captured_on)` |

`cards.name` has a trigram GIN index (`pg_trgm`) for fuzzy name search. The migration creates the extension.

Users, collections and decks arrive in phase 3.

## Commands

```bash
pnpm --filter @mtg-vault/db generate        # create a migration after editing src/schema.ts
DATABASE_URL=postgres://... pnpm --filter @mtg-vault/db migrate   # apply migrations
```

`drizzle-kit generate` needs no database. `migrate` needs `DATABASE_URL`.

Migrations in `migrations/` are committed. `0000_init.sql` was edited by hand to add `CREATE EXTENSION IF NOT EXISTS pg_trgm;` at the top, because the GIN index depends on it; keep that line if the file is ever regenerated.

## Status

The schema and the first migration are written and typechecked. They have **not been applied to a real database yet** (waiting for the Neon database).
