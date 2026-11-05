# ADR 0014 — Card scanning with art fingerprints, on the device

**Status:** accepted (the index and its job; the scanner screen comes in later changes)

## Context
We want to register cards by pointing a phone or webcam at them: one by one in a batch, or a whole deck. The collection has cards in English, Spanish, Japanese and Russian, so reading the card's name would need a text-recognition model per language and a translation to the English names we store. The database is also close to the free Neon limit (475 MB of 0.5 GB, see [apps/jobs](../../apps/jobs/README.md)), so a large new table is not welcome.

We measured two signals on five real, mostly blurry photos (spike, 2026-11-04):
- **Text on the bottom-left line** (set, number, language) read with Tesseract.js: correct on one sharp photo, partly on another, garbage on the blurry ones and on a card without that line.
- **Art fingerprint** (256-bit difference hash) against 305 cards: the right card came first in 5 of 5 photos, at distance 44–73, with the runner-up at 95 or more. This included a Spanish card photographed sideways.

## Decision
- **Identify a card by its art.** The browser shrinks the photo's art to 17×16 grey pixels, computes a 256-bit hash and looks for the nearest hash in an index. The art is the same in every language. `artHash`, `hammingDistance`, `nearestArt` and `matchConfidence` live in [`packages/shared/src/art-hash.ts`](../../packages/shared/src/art-hash.ts), pure and unit tested.
- **The index is a static file, not a database table.** One entry per illustration (not per printing): illustration id, oracle id and hash, 64 bytes each. Scryfall had 55,837 illustrations on 2026-11-04, so the file is about 3.6 MB. Reprints with the same art share an entry. Format: "MVAI", version, count, entries; documented in the code.
- **A GitHub Actions job builds it** (`apps/jobs/src/art-index.ts`, workflow `art-index`, weekly). It reads the same Scryfall bulk file as the import, downloads each new illustration's `art_crop`, and starts from the previous index so only new art is downloaded. It refuses to replace the index when more than 2% of the downloads fail. The result is published as an asset of the `art-index` GitHub release.
- **Nothing is stored in Neon.** The scanner downloads the file once and keeps it on the device.
- **Everything runs on the device.** Photos are never uploaded.
- **The bottom-left line is a refinement, not the identifier.** When it can be read it will pick the exact printing; when it cannot, the user chooses among the card's printings, as in the rest of the app.
- **The match is never silent.** `matchConfidence` says sure, maybe or none; the scanner will ask the user to confirm anything that is not sure.

## Alternatives considered
- **Read the name with OCR:** needs a model per language (Japanese and Russian add large downloads) and fails on blurry photos.
- **Image embeddings (CLIP-style) for every printing:** more tolerant of difficult photos, but a 52 MB model and file, and onnx in the browser was not measured. Kept as a fallback if the hash proves too weak on the full catalog.
- **A vector index in Neon (pgvector):** uses the storage we are short of, and needs a server call per scan.
- **Upload photos to the API and recognise them there:** sends users' photos to a server for no gain.

## Consequences
- The 5-photo test is small. The thresholds in `matchConfidence` are provisional until measured on the full index, with sleeved and foil cards, and with the browser's own image shrinking (which differs slightly from the job's).
- The browser's shrinking must reproduce the job's (grey, 17×16, stretched). The job's step is `fingerprint()` in `art-index.ts`; the scanner change will test the browser side against sample images.
- Cards with identical art in different printings cannot be told apart by this step alone.
- A full first build downloads about 56,000 small images (roughly 30 minutes) and runs weekly after that, mostly doing nothing.
- The API serves the file (`GET /art-index`): GitHub release downloads send no CORS headers, so the API streams them with long cache headers (streamed, so Vercel's 4.5 MB limit for ordinary responses does not apply as the index grows).
