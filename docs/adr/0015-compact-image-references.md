# ADR 0015 — Store image references compactly to free Neon storage

**Status:** proposed (not built; the measurement in step 1 decides whether it goes ahead)

## Context
The free Neon plan holds 0.5 GB. Table sizes measured on 2026-11-05, after the one-off `VACUUM FULL`:

| Table | Size | Rows | Per row |
|---|---|---|---|
| `printings` | 198 MB | 120,024 | ~1.6 KB |
| `cards` | 40 MB | 39,287 | ~1 KB |
| `price_snapshots` | 13 MB | 108,863 | ~125 B |
| everything else | < 1 MB | | |

The tables add up to about 252 MB; we have not read the total Neon reports now. `printings` is 80 % of it. The likely cause (not yet confirmed with a per-column size) is `image_uris`, the whole Scryfall object with about seven URLs of roughly 100 bytes each, while the clients use three (`small`, `normal`, `art_crop`). Prices are not the problem, so adding price providers does not need history to be dropped.

## Decision
1. **Measure first, on the Scryfall bulk file, without touching production:** how many image URLs follow Scryfall's usual pattern (a directory from the first characters of the card id, the card id, a version number after `?`). Also measure `pg_column_size(image_uris)` in Neon to confirm it is the cause.
2. **If most URLs follow the pattern,** store a short version value per printing and build the URLs in the API (`toCardImage`). Printings whose URLs do not follow the pattern keep the full object, so nothing is guessed.
3. **Migrate in steps:** add the new column, fill it, change the API to read it with a fall-back to the old column, check production, and only then empty `image_uris`. Run `VACUUM FULL printings` once at the end (an exclusive lock, outside an import). Any change to production data is confirmed with the owner first.

## Alternatives considered
- **Delete printings in languages nobody uses:** saves space but loses the exact printing of Spanish, Japanese and Russian cards, which the scanner needs. Not done without the owner's request.
- **Move the catalog out of Neon (static files):** a larger redesign; only if this is not enough.
- **A paid Neon plan:** out of scope for now.

## Consequences
- Scryfall's URL layout is a convention, not a documented contract. If it changes, the fall-back column keeps working for the printings that do not match, and the check in step 1 can be repeated.
- The saving (my estimate, 60 to 90 MB) is unconfirmed until step 1 is done.
