---
name: catalog-import
description: Run and verify the Scryfall catalog import (import-scryfall) or the scanner art index (art-index) for mtg-vault, and diagnose failures. Use when the user says to launch the import, refresh the catalog, fill new printing columns, or rebuild the art index.
---

# Catalog import and art index

Both run as GitHub Actions workflows (weekly cron plus manual). Run them from the default branch after the code change that needs them is merged.

## Import
```bash
gh workflow run import-scryfall.yml
gh run list --workflow=import-scryfall.yml --limit 1
gh run watch <run-id> --exit-status
```
Script: `apps/jobs/src/import-scryfall.ts` (upsert by printing id, updates only rows whose listed columns changed). Migrations needed by new columns must already be applied (`db-migration`).

Verify read-only against production (script in `packages/db`, delete after): total printings (~120k), counts for the columns you expected to fill, and a spot check of known examples. Final log line reports how many printings were "left out for clashing".

### Known failure: `23505 printings_set_number_lang_uq`
Scryfall gave an existing set+number+language a new id. The importer now drops such rows (`dropCollisions`) and keeps the old row because it may have prices, copies or decks. If it reappears, read the log for the offending ids; do not delete rows.

## Art index
`gh workflow run art-index.yml`. It builds the fingerprint index and publishes it as a release asset (large download, up to 2 h). Env knobs in `apps/jobs/src/art-index.ts`: `BULK_TYPE` (`default_cards`, or `all_cards` for other languages) and `INDEX_LANGS` (e.g. `ja`). Ask the user before running a non-default build.

## Report
State: run id and result, rows changed, what is now filled, anything skipped, and DB size (Neon free limit 0.5 GB).
