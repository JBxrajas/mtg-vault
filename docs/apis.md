# External APIs and data sources

## Scryfall (main source)
- Docs: https://scryfall.com/docs/api
- Free. Requires `User-Agent` and `Accept` headers on every request.
- Courtesy rate limit: 50–100 ms between requests (roughly 10 per second at most).
- **Bulk data** (`/bulk-data`): files with the whole catalog, refreshed periodically. Each entry exposes `jsonl_download_uri`, a gzipped JSON Lines file (one card per line). Use `default_cards` (one entry per printing) or `oracle_cards` (one per card). Import the bulk file instead of querying card by card.
- Prices (`prices.usd`, `usd_foil`, `eur`, `eur_foil`, `tix`): current value only, **no history**. Price data refreshes once a day, so a daily snapshot is enough.
- Fuzzy name lookup: `/cards/named?fuzzy=` (useful for OCR output).
- Images: `image_uris` field (`small`, `normal`, `large`, `png`, `art_crop`, `border_crop`). We store these URLs per printing (`printings.image_uris`) and hotlink them; we do not copy the files. Scryfall's guidelines: do not crop or distort card images (use their `art_crop` for artwork), do not paywall them, and credit Scryfall. The search results expose `small`, `normal` and `artCrop` of the most recent printing that has an image. **Sizes (measured 2026-11-04):** `art_crop` is 626 × 457 px and `png` (the whole card) is 745 × 1040 px; Scryfall serves nothing larger, so those are the "high resolution" we can show. The artist is not in our database: the art page (`#/art/:printingId`) asks `GET https://api.scryfall.com/cards/:id` from the user's browser, only when someone opens it (one request per card and day, cached), and shows the artist, the flavor text and links to the card and to the artist's other art on Scryfall. Our printing ids are Scryfall ids.

## Collection files (CSV import)

The collection import reads the CSV that Moxfield exports. Its layout, as the import expects it: `Count, Tradelist Count, Name, Edition, Condition, Language, Foil, Tags, Last Modified, Collector Number, Alter, Proxy, Purchase Price`, where `Edition` is the set code, `Condition` is spelled out (Near Mint, Lightly Played, …), `Language` is a name (English, Spanish, …), `Foil` is empty, `foil` or `etched`, and `Proxy` rows are skipped. Headers are matched by name, ignoring case, spaces and order, with aliases (`Quantity`, `Set`, `Set code`, `Number`, `Scryfall ID`, `Purchase price`…), so files from other tools with similar headers, such as ManaBox (which also carries Scryfall ids), should work too.

**What was and was not tested:** the reader and the import were tested with CSV files written in this layout from real cards, not with a real Moxfield export, and not with ManaBox or Deckbox files. If a real file shows something unexpected, the preview lists the columns it did not use and the lines it could not read.

### Collection export

The export writes the same layout back: `Count, Name, Edition, Condition, Language, Foil, Collector Number, Scryfall ID, Purchase Price` (the Scryfall id identifies the printing exactly), with the condition and language spelled out. A test reads an exported file back with the import parser and gets the same stacks. Notes and acquisition dates are not exported.

## Deck lists (text import and export)

A deck list is one card per line: `4 Lightning Bolt`, `4x Lightning Bolt`, `4 Lightning Bolt (M10) 146` or a bare name for one copy. Sections start with a line `Commander`, `Deck` (or `Main`), `Sideboard` or `Maybeboard` (a trailing colon is fine; `Companion` goes to the sideboard); `SB: 2 Pyroblast` is also read as sideboard. Without any section line, the first blank line after the cards starts the sideboard (MTGO style). `//` and `#` lines are comments. The set, number and `*F*` foil marker are dropped. Export writes `Commander`, `Deck`, `Sideboard` and `Maybeboard` sections (no headers when only the main board is used), which `parseDeckList` reads back (tested).

**What was and was not tested:** the reader was tested with lists written in the styles above, not with real exports from Moxfield, Arena, MTGO or Archidekt. Section names are English only. Archidekt-style group headings such as `Creatures (12)` are not understood and would be reported as cards that were not found.

## MTGJSON
- https://mtgjson.com
- Free. Includes historical prices from several providers (Cardmarket, TCGplayer, …). A complement to backfill history.

## Market prices
- **TCGplayer:** no longer grants new API access.
- **Cardmarket:** access must be requested.
- We start with Scryfall and MTGJSON prices.

## Card scanning
No API solves this. It is built on the client, designed in [ADR 0014](adr/0014-card-scanning-with-art-fingerprints.md): a 256-bit art fingerprint of the photo is matched against an index of every illustration in Scryfall, built weekly from Scryfall's `art_crop` images by the `art-index` job and published as an asset of this repository's `art-index` GitHub release. The API streams it at `GET /art-index`. Reading the card's text (Tesseract.js) was tested and is only a possible refinement for the printing, not the way a card is identified: it failed on blurry photos and would need a model per language.

## EDHREC
No official API, and not a data source for us. Its terms allow personal, non-commercial use only and forbid scripts that make automated requests, copying its content and building a competing site; its pages also refuse to be framed (`X-Frame-Options: SAMEORIGIN`). The app only links to a commander's EDHREC page, in a new tab or in a side window the user's browser opens. Nothing is fetched, cached or copied, and rankings derived from EDHREC (such as Scryfall's `edhrec_rank`) are not used either. See [ADR 0013](adr/0013-commander-knowledge-and-analysis.md).

## Moxfield
Unofficial API; do not depend on it. Only support its CSV import and export format.
