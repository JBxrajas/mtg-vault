# External APIs and data sources

## Scryfall (main source)
- Docs: https://scryfall.com/docs/api
- Free. Requires `User-Agent` and `Accept` headers on every request.
- Courtesy rate limit: 50–100 ms between requests (roughly 10 per second at most).
- **Bulk data** (`/bulk-data`): files with the whole catalog, refreshed periodically. Each entry exposes `jsonl_download_uri`, a gzipped JSON Lines file (one card per line). Use `default_cards` (one entry per printing) or `oracle_cards` (one per card). Import the bulk file instead of querying card by card.
- Prices (`prices.usd`, `usd_foil`, `eur`, `eur_foil`, `tix`): current value only, **no history**. Price data refreshes once a day, so a daily snapshot is enough.
- Fuzzy name lookup: `/cards/named?fuzzy=` (useful for OCR output).
- Images: `image_uris` field (`small`, `normal`, `large`, `png`, `art_crop`, `border_crop`). We store these URLs per printing (`printings.image_uris`) and hotlink them; we do not copy the files. Scryfall's guidelines: do not crop or distort card images (use their `art_crop` for artwork), do not paywall them, and credit Scryfall. The search results expose `small`, `normal` and `artCrop` of the most recent printing that has an image.

## Collection files (CSV import)

The collection import reads the CSV that Moxfield exports. Its layout, as the import expects it: `Count, Tradelist Count, Name, Edition, Condition, Language, Foil, Tags, Last Modified, Collector Number, Alter, Proxy, Purchase Price`, where `Edition` is the set code, `Condition` is spelled out (Near Mint, Lightly Played, …), `Language` is a name (English, Spanish, …), `Foil` is empty, `foil` or `etched`, and `Proxy` rows are skipped. Headers are matched by name, ignoring case, spaces and order, with aliases (`Quantity`, `Set`, `Set code`, `Number`, `Scryfall ID`, `Purchase price`…), so files from other tools with similar headers, such as ManaBox (which also carries Scryfall ids), should work too.

**What was and was not tested:** the reader and the import were tested with CSV files written in this layout from real cards, not with a real Moxfield export, and not with ManaBox or Deckbox files. If a real file shows something unexpected, the preview lists the columns it did not use and the lines it could not read.

## MTGJSON
- https://mtgjson.com
- Free. Includes historical prices from several providers (Cardmarket, TCGplayer, …). A complement to backfill history.

## Market prices
- **TCGplayer:** no longer grants new API access.
- **Cardmarket:** access must be requested.
- We start with Scryfall and MTGJSON prices.

## Card scanning
No API solves this. It is built on the client by combining:
1. OCR (Tesseract.js) of the name and collector number, then fuzzy lookup on Scryfall.
2. Perceptual hash (pHash) of the image against Scryfall images, to tell printings apart.
OpenCV.js handles cropping and perspective correction.

## Moxfield
Unofficial API; do not depend on it. Only support its CSV import and export format.
