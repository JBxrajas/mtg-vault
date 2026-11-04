# External APIs and data sources

## Scryfall (main source)
- Docs: https://scryfall.com/docs/api
- Free. Requires `User-Agent` and `Accept` headers on every request.
- Courtesy rate limit: 50–100 ms between requests (roughly 10 per second at most).
- **Bulk data** (`/bulk-data`): files with the whole catalog, refreshed periodically. Each entry exposes `jsonl_download_uri`, a gzipped JSON Lines file (one card per line). Use `default_cards` (one entry per printing) or `oracle_cards` (one per card). Import the bulk file instead of querying card by card.
- Prices (`prices.usd`, `usd_foil`, `eur`, `eur_foil`, `tix`): current value only, **no history**. Price data refreshes once a day, so a daily snapshot is enough.
- Fuzzy name lookup: `/cards/named?fuzzy=` (useful for OCR output).
- Images: `image_uris` field (`small`, `normal`, `large`, `png`, `art_crop`, `border_crop`). We store these URLs per printing (`printings.image_uris`) and hotlink them; we do not copy the files. Scryfall's guidelines: do not crop or distort card images (use their `art_crop` for artwork), do not paywall them, and credit Scryfall. The search results expose `small`, `normal` and `artCrop` of the most recent printing that has an image.

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
