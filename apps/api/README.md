# apps/api

Hono API. Runs on plain Node locally and, later, on Vercel Functions (no API project exists on Vercel yet).

```bash
pnpm --filter @mtg-vault/api dev   # http://localhost:3001; loads ../../.env.local if present
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (search) | Pooled Neon connection, see [docs/neon.md](../../docs/neon.md) |
| `CORS_ORIGINS` | in production | Comma-separated browser origins allowed to call the API (also Better Auth's trusted origins). Defaults to `http://localhost:5173` |
| `BETTER_AUTH_SECRET` | yes (auth) | Signing secret, `openssl rand -base64 32`. Never commit it |
| `BETTER_AUTH_URL` | yes (auth) | Public URL of the API: `http://localhost:3001` locally, `https://mtg-vault-api.vercel.app` in production |

`.env.example` at the repository root lists them. `pnpm dev:api` loads `.env.local`.

## Deployment

Deployed as its own Vercel project, `mtg-vault-api` (root `apps/api`, Hono preset); see [docs/vercel.md](../../docs/vercel.md). Vercel's zero-config Hono support runs the default export of the entry file, which re-exports the app from `src/app.ts`. Locally the same app is served by `src/dev.ts`.

Vercel only builds `apps/api`, and the workspace packages (`@mtg-vault/shared`, `@mtg-vault/db`) export TypeScript source, so a plain deploy crashed with `ERR_MODULE_NOT_FOUND`. `apps/api/vercel.json` therefore runs `pnpm build`, which bundles the app with tsup (`tsup.config.ts`) into `apps/api/index.js` (git-ignored). That file, found at the root, is the entry point Vercel runs; third-party dependencies stay external, which is why `postgres` is a direct dependency of the API. Build it locally with `pnpm --filter @mtg-vault/api build`.

## Endpoints

### `GET /health`

Returns `{ "ok": true }`.

### Accounts and sessions

Username and password, with Better Auth; sessions are Bearer tokens ([ADR 0009](../../docs/adr/0009-username-login-with-bearer-tokens.md)).

| Endpoint | Body | Result |
|---|---|---|
| `POST /auth/register` | `{ "username", "password" }` | `200` with the user and a `set-auth-token` header; `400` for invalid input or a taken username. Also creates the user's collection |
| `POST /api/auth/sign-in/username` | `{ "username", "password" }` | `200` with `set-auth-token`; `401` for wrong credentials |
| `POST /api/auth/sign-out` | none, `Authorization: Bearer <token>` | `200`; the token stops working |
| `GET /me` | `Authorization: Bearer <token>` | `{ "user": { "id", "username", "displayUsername" } }`, or `401` |

`POST /api/auth/sign-up/email` is closed (`404`) so every account has a username. Send the token on later requests as `Authorization: Bearer <token>`. Other Better Auth routes under `/api/auth/*` are available but not used by the web app yet.

### Collection (requires `Authorization: Bearer <token>`, `401` otherwise)

The signed-in user's single collection ([ADR 0008](../../docs/adr/0008-users-collection-binders-decks.md)). A **stack** is copies that share printing, finish, condition and language. Users only ever see and change their own stacks (another user's id answers `404`).

| Endpoint | Body | Result |
|---|---|---|
| `GET /collection/items` | none | `{ items: CollectionItem[] }`: each stack with card name, type line, mana value (`cmc`), color identity, set, collector number, rarity, image, `unitPrice` (latest market price in USD for that finish, or `null`) and `pricesOn` |
| `POST /collection/items` | `{ printingId, quantity, finish?, condition?, language?, purchasePrice?, acquiredOn?, notes? }` | `201 { item }`. Defaults: `nonfoil`, `NM`, `en`. Adding an existing stack **adds to its quantity** (a given purchase price, date or note replaces the stored one). `400` if the printing does not come in that finish or the stack would exceed 9999; `404` for an unknown printing |
| `PATCH /collection/items/:id` | any of `{ quantity, purchasePrice, acquiredOn, notes }` (`null` clears the last three) | `200 { item }`; `404` if not yours; `409` if `quantity` is lower than the copies placed in binders |
| `DELETE /collection/items/:id` | none | `204`; also removes the stack's binder placements; `404` if not yours |

Finish, condition and language identify a stack, so they cannot be patched: remove the stack and add a new one. Binder endpoints are not implemented yet; the database and the `409` rule already are.

### Decks (requires `Authorization: Bearer <token>`, `401` otherwise)

A user has many decks ([ADR 0008](../../docs/adr/0008-users-collection-binders-decks.md)). Only the owner can read or change a deck: another user's deck answers `404`. A deck lists **oracle cards**, not printings, so it is independent of what is owned; each card comes with `owned`, the copies of it (any printing) in the user's collection.

| Endpoint | Body | Result |
|---|---|---|
| `GET /decks` | none | `{ decks: DeckSummary[] }`, most recently changed first; `cardCount` is the main plus commander boards |
| `POST /decks` | `{ name, format?, description?, isPublic? }` | `201 { deck }`. Defaults: `casual`, private |
| `GET /decks/:id` | none | `{ deck, cards }`; each card has name, mana cost, type line, cmc, `oracleText`, `colorIdentity`, `board`, `quantity`, image and `owned` (the web app's Commander analysis reads the text and the colors) |
| `PATCH /decks/:id` | any of `{ name, format, description, isPublic }` | `200 { deck }` |
| `DELETE /decks/:id` | none | `204`; its cards go with it |
| `POST /decks/:id/cards` | `{ oracleId, quantity, board? }` | `201` with the updated `{ deck, cards }`. **Adds** to an existing entry; `board` defaults to `main`; `400` above 999 copies, `404` for an unknown card |
| `PUT /decks/:id/cards` | `{ oracleId, board?, quantity }` | `200` with the updated deck. **Sets** the copies; `0` removes the card; `404` if the card is not on that board |

Formats: standard, pioneer, modern, legacy, vintage, commander, oathbreaker, brawl, pauper, historic, casual. Boards: `main`, `sideboard`, `maybeboard` and `commander`. Dividing the deck by card type (creature, sorcery, instant, …) is done by the client with `groupByCategory` from `packages/shared`, from each card's type line. **Format rules are not enforced** (deck size, copy limits, legality): the deck size and the target of the format (`deckTargetSize`: 60, Commander 100, none for casual) are shown, not required.

### Importing a deck list

`POST /decks/:id/import` (Bearer token) takes `{ rows }`, 1 to 1000 rows already read from a text list by `parseDeckList` in `packages/shared` (the web app reads it and sends it in chunks of 500). A row has `line`, `name`, `quantity` (1 to 999) and `board`. It answers `{ created, updated, unchanged, problems }`; `404` when the deck is not the user's.

- **The count sets the copies** of that card on that board, as in the collection import: importing the same list twice changes nothing, and cards that are not in the list are left alone. Rows for the same card and board are added together (up to 999).
- **Finding the card** is by name only (a deck holds oracle cards, not printings): case-insensitive, and the front face of a double-faced card is enough (`Fire` finds `Fire // Ice`). The set and number a list may carry are dropped by the parser.
- **`problems`**: no card with that name, the `commander` board in a format that has none (only Commander, Brawl and Oathbreaker do), or more than 999 copies.
- The SQL was run end to end on a throwaway Neon branch (lower-case names, double-faced cards, duplicates, unknown card, second import without changes, a changed count, another user's deck, the commander board in Modern).
- Exporting needs no endpoint: the web app writes the list from `GET /decks/:id` with `formatDeckList`, and the collection CSV from `GET /collection/items` with `collectionToCsv`.

### Importing a collection

`POST /collection/import` (Bearer token) takes `{ rows }`, 1 to 1000 rows already read from a CSV by `parseCollectionCsv` in `packages/shared` (the web app does the reading and sends the file in chunks of `IMPORT_CHUNK` = 500). A row has `line`, `name`, `count` and optionally `setCode`, `collectorNumber`, `scryfallId`, `finish`, `condition`, `language`, `purchasePrice`, `notes`. It answers `{ created, updated, unchanged, adjusted, problems }`.

- **The count sets the quantity** of its stack; it is not added to what is there. Importing the same file twice changes nothing, and stacks that are not in the file are left alone. A purchase price or note in the file replaces the stored one; an empty one keeps it. A stack is not lowered below the copies placed in binders.
- **Finding the card**, in this order, each pass only for the rows not yet resolved: Scryfall id; set code and collector number (leading zeros ignored); set code and card name; card name alone. Every step except the id also requires the **card name to match**, so a wrong number or set can never import a different card; it either finds the same card elsewhere or is reported. English printings win, then the most recent. Names match case-insensitively, and a front-face name finds a double-faced card.
- **`adjusted`** lists rows imported with a change: the finish the printing does not have becomes one it has, the number was not in that set (another printing of the card in the set was used), or the set had no such card (matched by name only). **`problems`** lists rows that could not be imported (no such card, or more than 9999 copies).
- Rows that land on the same stack, even from different lines, are added together.
- A 3000-line file takes about 5 seconds in 6 requests, the slowest about 1.1 s (measured locally against Neon); a second import of the same file takes about the same.

### `GET /art-index`

The art-fingerprint index the card scanner matches photos against ([ADR 0014](../../docs/adr/0014-card-scanning-with-art-fingerprints.md)): a binary file of about 3.6 MB (format in `packages/shared/src/art-hash.ts`, built by the `art-index` job). No login. The API streams the `art-index.bin` asset of the repository's `art-index` GitHub release (a browser cannot fetch release downloads itself, they send no CORS headers) with `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`, so the CDN serves it and GitHub is hit about once a day. Streaming also keeps it clear of Vercel's 4.5 MB limit for ordinary responses. `503` until the first index is published, `502` if GitHub fails. `ART_INDEX_URL` overrides the source (for a fork or tests).

### `GET /cards/search`

Fuzzy search of oracle cards by name, backed by the `pg_trgm` index on `cards.name`.

| Parameter | Required | Description |
|---|---|---|
| `q` | yes | Name or fragment, 2–100 characters. Typos are tolerated (`lightnin bolt`). |
| `limit` | no | 1–50, default 20 |
| `type` | no | Substring of the type line, for example `instant` |
| `colors` | no | Comma-separated color identity the card must include, from `W,U,B,R,G` |

Ordering: exact name, then names starting with `q`, then trigram similarity.

Each result carries `oracleText` and `colorIdentity` (the web app checks with them whether a card can be a commander and shows its colors) and `image`: the `small`, `normal` and `artCrop` URLs of the **most recent printing that has an image** (or `null`). They are Scryfall URLs hotlinked by the clients, not files we store. The printing is picked with a `lateral` join that runs only for the rows kept by `limit`.

```json
{ "results": [
  { "oracleId": "4457ed35-…", "name": "Lightning Bolt", "manaCost": "{R}", "typeLine": "Instant", "oracleText": "Lightning Bolt deals 3 damage to any target.", "colorIdentity": ["R"], "similarity": 0.81,
    "image": { "small": "https://cards.scryfall.io/small/…", "normal": "https://cards.scryfall.io/normal/…", "artCrop": "https://cards.scryfall.io/art_crop/…" } }
] }
```

### `GET /cards/:oracleId/printings`

Every printing of one oracle card (the `oracleId` from the search results), newest first. Each entry has the set name and code, collector number, language, rarity, release date, finishes, the `image` URLs (as in the search) and the **latest recorded price** with its date:

```json
{ "printings": [
  { "id": "…", "setCode": "lea", "setName": "Limited Edition Alpha", "collectorNumber": "161", "lang": "en",
    "rarity": "common", "releasedAt": "1993-08-05", "finishes": ["nonfoil"], "image": { "small": "…", "normal": "…", "artCrop": "…" },
    "prices": { "usd": 1800, "usdFoil": null, "usdEtched": null, "eur": 3835.09, "eurFoil": null, "tix": null }, "pricesOn": "2026-11-04" }
] }
```

`prices` and `pricesOn` are `null` when no price has been recorded for that printing. An id that is not a UUID returns `400`; a card with no printings returns `404`.

Invalid parameters return `400` with the Zod issues. The query schema lives in `packages/shared` (`cardSearchQuerySchema`) so web and desktop can reuse it.

Verified manually against the Neon catalog (120k printings): a typo query, the `type` and `colors` filters, and the `400` cases. The import was run end to end on a throwaway Neon branch with a Moxfield-layout CSV built from real cards (20 checks: exact match, repeated lines, leading zero, wrong number, wrong set, unknown card, a number that belongs to another card, foil that does not exist, double-faced front name, proxy skipped, language and notes, idempotent re-import, a changed count, the binder floor, and 3000 lines). That run found a real bug, a set and number accepted without checking the name, now fixed. The deck endpoints were run end to end on a throwaway Neon branch as well (create, add and grow an entry, boards kept apart, the 999 cap, unknown card, set and remove, `owned` from the collection, update, list counts, isolation between two users, delete cascading to its cards). The collection endpoints were run end to end on a throwaway Neon branch too (18 checks: add, merge into an existing stack, separate condition stack, finish not offered by the printing, unknown printing, 9999 cap, list with names and images, binder `409`, patch, isolation between two users, delete cascading to binder placements); that script is not part of the suite either. The account flow was also run end to end on a throwaway Neon branch (register, duplicate username, sign-in in any letter case, wrong password, `/me`, sign-out, hashed password, collection created); that script is not part of the test suite. Unit tests (`app.test.ts`, `cards.test.ts`) cover validation, status codes, the response mapping and LIKE escaping with the data layer mocked; the SQL itself is not covered by automated tests.
