# apps/jobs

Batch jobs that write to the Neon database. They run in GitHub Actions (see [ADR 0003](../../docs/adr/0003-jobs-in-github-actions.md)), not on Vercel.

## import-scryfall

Imports the Scryfall catalog into `sets`, `cards` and `printings` (see [packages/db](../../packages/db/README.md)).

1. Fetches `/sets` and upserts every set.
2. Reads `/bulk-data`, downloads the gzipped JSON Lines file for `default_cards` (one entry per printing) to `data/` (git-ignored).
3. Streams it line by line and upserts cards (by `oracle_id`) and printings (by Scryfall id) in batches of 1000.

It is idempotent: running it again updates rows in place. Cards without an `oracle_id`, and printings that would repeat a set, number and language, are skipped and counted.

Prices are not imported yet; daily snapshots arrive in phase 4.

### Run it

```bash
DATABASE_URL_UNPOOLED=postgres://... pnpm --filter @mtg-vault/jobs import:scryfall
```

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL_UNPOOLED` | — (falls back to `DATABASE_URL`) | Direct connection to Neon |
| `BULK_TYPE` | `default_cards` | Any Scryfall bulk type, for example `oracle_cards` |
| `LIMIT` | unlimited | Stop after N printings (testing) |
| `DATA_DIR` | `data` | Where the bulk file is stored |
| `SKIP_DOWNLOAD` | unset | Reuse the file already in `DATA_DIR` |

### Schedule

`.github/workflows/import-scryfall.yml` runs it every Monday at 05:17 UTC and on demand (Actions tab → import-scryfall → Run workflow, or `gh workflow run import-scryfall`). It needs the repository secret `DATABASE_URL_UNPOOLED` (`gh secret set DATABASE_URL_UNPOOLED`, value from `.env.local`).

### Status

Verified locally against Neon with `BULK_TYPE=oracle_cards LIMIT=3000`: 1066 sets, 3000 cards and 3000 printings; a second run left the counts unchanged. The full `default_cards` run, and the workflow itself, have **not** been run yet.
