# apps/jobs

Batch jobs that write to the Neon database. They run in GitHub Actions (see [ADR 0003](../../docs/adr/0003-jobs-in-github-actions.md)), not on Vercel.

## import-scryfall

Imports the Scryfall catalog into `sets`, `cards` and `printings` (see [packages/db](../../packages/db/README.md)).

1. Fetches `/sets` and upserts every set.
2. Reads `/bulk-data`, downloads the gzipped JSON Lines file for `default_cards` (one entry per printing) to `data/` (git-ignored).
3. Streams it line by line and upserts cards (by `oracle_id`) and printings (by Scryfall id) in batches of 1000.

It is idempotent: running it again updates rows in place. Cards without an `oracle_id`, and printings that would repeat a set, number and language, are skipped and counted. A printing whose id is new but whose set, number and language already belong to a row with another id (Scryfall replaced a card; seen in *Arena New Player Experience* on 2026-11-06) is left out and counted as well, because the unique key would otherwise fail the whole run; the existing row is kept and nothing is deleted.

It also records prices: Scryfall sends current prices with each card, and the job writes a row in `price_snapshots` (dated that UTC day) **only when a printing's prices differ from its latest snapshot**. The first run writes about one row per priced printing; later runs write only the changes. This keeps history without growing by ~120k rows a day (the free Neon plan has 0.5 GB). Prices are normalized to two decimals (`src/prices.ts`, unit tested).

Upserts of `sets`, `cards` and `printings` use `ON CONFLICT DO UPDATE ... WHERE (old) IS DISTINCT FROM (new)`, so rows that did not change are not rewritten. Before this, every import rewrote all rows and left dead copies behind, which bloated `printings` to almost four times its real size.

### Run it

```bash
DATABASE_URL_UNPOOLED=postgres://... pnpm --filter @mtg-vault/jobs import:scryfall
```

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL_UNPOOLED` | — (falls back to `DATABASE_URL`) | Direct connection to Neon |
| `BULK_TYPE` | `default_cards` | Any Scryfall bulk type, for example `oracle_cards` |

The import also stores, per printing, the **flavor name** (`flavor_name`: the name printed instead of the card's own, such as "Paradise Chocobo") and the **illustration ids** of its faces (`illustration_ids`). The first is how a deck list or a search finds those cards; the second is how the scanner suggests the printing that has the art it saw. They are filled on the next import after migration `0003` (existing rows stay empty until then).
| `LIMIT` | unlimited | Stop after N printings (testing) |
| `DATA_DIR` | `data` (relative to `apps/jobs` when run with `pnpm --filter`; the workflow passes an absolute path) | Where the bulk file is stored |
| `SKIP_DOWNLOAD` | unset | Reuse the file already in `DATA_DIR` |

### Schedule

`.github/workflows/import-scryfall.yml` runs it every Monday at 05:17 UTC and on demand (Actions tab → import-scryfall → Run workflow, or `gh workflow run import-scryfall`). It needs the repository secret `DATABASE_URL_UNPOOLED` (`gh secret set DATABASE_URL_UNPOOLED`, value from `.env.local`).

### Storage

`pg_database_size` was 475 MB on 2026-11-04, close to the 0.5 GB of the free plan, mostly dead space left by the earlier full-row upserts (`printings` took 392 MB for about 120k rows). `VACUUM FULL printings; VACUUM FULL cards;` rewrites the tables compactly. It takes an exclusive lock for the duration, so run it once, outside an import, before the first price import: `DATABASE_URL=<unpooled url>` with any Postgres client.

### Status

The first workflow run failed with `numeric field overflow`: a few cards have a mana value of 1,000,000, which did not fit `cards.cmc` (`numeric(6,1)`). Migration `0001` widens it to `numeric(10,1)`; apply migrations before the job runs (`pnpm --filter @mtg-vault/db migrate`). The job now prints the Postgres error and detail on failure.

After the fix, a full `default_cards` import was run from a local machine against Neon: 1066 sets, 39,287 cards and 120,024 printings, 0 skipped. Fuzzy search for "lightnin bolt" returns "Lightning Bolt" first. The workflow was then re-run from GitHub Actions on 2026-11-04 and succeeded with the same numbers (120,024 printings, 0 skipped).

## art-index

Builds the art-fingerprint index the card scanner will use ([ADR 0014](../../docs/adr/0014-card-scanning-with-art-fingerprints.md)). It does not touch the database.

1. Downloads (or reuses) the `default_cards` bulk file and lists every illustration of every paper printing: one entry per illustration, one per face of double-faced cards, first printing wins. Digital-only cards and missing or placeholder scans are skipped.
2. Loads the previous index if there is one and keeps its entries; only illustrations not in it are downloaded (`art_crop`, 6 at a time, retrying on 429 and 5xx).
3. Decodes each image with `sharp`, shrinks it to 17×16 grey pixels with `grayGridFromRgba` (the browser uses the same function), computes the 256-bit hash (`artHash`, both in `packages/shared`) and writes `art-index.bin` (64 bytes per entry, about 3.6 MB for the whole catalog) through a temporary file.
4. Fails, keeping the previous file, when more than 2% of the downloads fail.

```bash
pnpm --filter @mtg-vault/jobs art-index
```

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `data` (relative to `apps/jobs` when run with `pnpm --filter`; the workflow passes an absolute path) | Where the bulk file and the index are kept |
| `OUT` | `$DATA_DIR/art-index.bin` | Index file |
| `CONCURRENCY` | `6` | Parallel image downloads |
| `LIMIT` | unlimited | Fingerprint at most N new illustrations (testing) |
| `SKIP_DOWNLOAD` | unset | Reuse the bulk file already in `DATA_DIR` |
| `BULK_TYPE` | `default_cards` | `all_cards` also has the printings in other languages, so art that exists only in one (a Japanese showcase frame) is indexed; a much bigger download. Not run yet |
| `INDEX_LANGS` | unset | With `all_cards`: keep only these languages and English, for example `ja,es` |

`.github/workflows/art-index.yml` runs it every Monday at 06:43 UTC (after the catalog import) and on demand. It downloads the previous index from the `art-index` GitHub release, builds, and uploads the new file to that release. No secrets are needed. The first full run fingerprints about 56,000 images (the first run on GitHub took about 2 minutes 15 seconds with no failures); later runs only add new art.

## Scanner evaluation (`scan-eval`)

`pnpm --filter @mtg-vault/jobs scan-eval` measures the scanner with simulated camera shots of real cards; it is a tool for tuning, not part of any workflow. It downloads random cards from Scryfall once (cached in `DATA_DIR/eval`), places each on a textured table in a 1280×720 frame, spoils the picture one factor at a time (scale, shift, tilt, blur, light, grain, glare, sleeve haze) and prints how many were recognised against an index file (`INDEX`, default `data/art-index.bin`; download the published one with `gh release download art-index`). `CARDS` sets how many cards (default 250, it takes minutes), `ONLY` picks conditions, `VARIANT=search` uses the search around the guide, `CAL` writes distance and gap per shot to a file. The results and their limits are in [ADR 0014](../../docs/adr/0014-card-scanning-with-art-fingerprints.md).
