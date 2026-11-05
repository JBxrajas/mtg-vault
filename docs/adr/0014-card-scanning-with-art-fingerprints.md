# ADR 0014 — Card scanning with art fingerprints, on the device

**Status:** accepted (index, job, API route and scanner screen built; tuning on real cameras pending)

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
- **The printing is chosen by language, then by the user.** The photo identifies the art. The scanner suggests the newest printing in the language the user chose (English, Spanish, Japanese, Russian and the other Scryfall languages), then English, and lets them change printing, finish and quantity before adding.
- **Flat pictures never match.** A flat or empty picture hashes to almost all zeros and would sit close to some card; `isBlankHash` refuses it.
- **The match is never silent.** `matchConfidence` says sure, maybe or none; the scanner will ask the user to confirm anything that is not sure.

## Alternatives considered
- **Read the name with OCR:** needs a model per language (Japanese and Russian add large downloads) and fails on blurry photos.
- **Image embeddings (CLIP-style) for every printing:** more tolerant of difficult photos, but a 52 MB model and file, and onnx in the browser was not measured. Kept as a fallback if the hash proves too weak on the full catalog.
- **A vector index in Neon (pgvector):** uses the storage we are short of, and needs a server call per scan.
- **Upload photos to the API and recognise them there:** sends users' photos to a server for no gain.

## Consequences
- The 5-photo test is small. The thresholds in `matchConfidence` are provisional until measured on the full index, with sleeved and foil cards, and with the browser's own image shrinking (which differs slightly from the job's).
- The shrinking is one function, `grayGridFromRgba` in `packages/shared` (luma, then the average of each of the 17×16 blocks), called by both the job and the browser, so only decoding the picture differs. Changing it changes every hash: the index must be rebuilt from scratch. On the five photos it gave the same results as the first test, made with a different resize (correct card first, distance 39–76, runner-up 94 or more).
- Cards with identical art in different printings cannot be told apart by this step alone.
- A full first build downloads about 56,000 small images (2 minutes 15 seconds on GitHub, no failures) and runs weekly after that, mostly doing nothing.
- The API serves the file (`GET /art-index`): GitHub release downloads send no CORS headers, so the API streams them with long cache headers (streamed, so Vercel's 4.5 MB limit for ordinary responses does not apply as the index grows).

## Automatic capture (revised)
The first version captured after three sharp readings and re-armed only when the focus fell below a low level (the card was "taken away"). On a textured table or a hand the focus never falls, and a high focus level was reached rarely, so in practice the user pressed the button for each card. It now decides from the fingerprint it already computes: capture when the view is steady (few bits change between readings), sharp enough and not flat; arm again when the view differs a lot from the last card taken. The limits (`FOCUS_TAKE` 0.6, `STEADY_DISTANCE` 28, `NEW_CARD_DISTANCE` 64 bits) are provisional and, like the focus limits, were reasoned from the 5-photo test and unit tests, not measured on a real camera.

## Recognition measured in a simulation, and the search around the guide
The first scanner compared one fingerprint, taken from where the guide says the art is. A simulation (`pnpm --filter @mtg-vault/jobs scan-eval`: 120 random cards from Scryfall placed on a textured table in a 1280×720 frame, spoiled one factor at a time, against the full index of 55,837 illustrations) showed what breaks it. Share of cards recognised as the top match:

| Shot | One fingerprint | Search around the guide |
|---|---|---|
| Card exactly in the guide | 84 % | 95 % |
| Shifted about 1.5 % | 28 % | 89 % |
| Tilted about 3° | 58 % | 91 % |
| Typical shot (scale, shift, tilt, blur, light, grain, sleeve haze) | 16 % | 87 % |
| Hard shot (twice the shift and tilt, blur, glare) | 3 % | 25 % |

Blur, uneven light, grain and a sleeve's haze barely changed the result; the fingerprint is made of fixed blocks, so what breaks it is geometry: a card a little off the guide. The capture now looks for the card around the guide (the guide as it is, then 10 % smaller and bigger, each shifted by two steps either way in both directions; 75 positions at most) and keeps the closest match, stopping early when one is clearly right (`src/scan/search.ts`). With the thresholds of `matchConfidence` unchanged, "sure" and wrong happened for 2 % of the typical shots and "sure" and right for 81 %. The worst case (no early stop) took 0.5 s on this machine; a phone is slower and it runs on the page's main thread, so a worker is a possible next step.

This is a **simulation** with synthetic framing: it says which shots break the matching, not the rate on a real phone. Not covered yet: tilt beyond about 5°, cards seen strongly from the side, double-faced and full-art cards, and real lenses. Photos uploaded from a file still use the three framings of `matchPhoto`.
