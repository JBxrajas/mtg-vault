# apps/api

Hono API. Runs on plain Node locally and, later, on Vercel Functions (no API project exists on Vercel yet).

```bash
pnpm --filter @mtg-vault/api dev   # http://localhost:3001; loads ../../.env.local if present
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (search) | Pooled Neon connection, see [docs/neon.md](../../docs/neon.md) |
| `CORS_ORIGINS` | in production | Comma-separated browser origins allowed to call the API. Defaults to `http://localhost:5173` |

## Deployment

Deployed as its own Vercel project, `mtg-vault-api` (root `apps/api`, Hono preset); see [docs/vercel.md](../../docs/vercel.md). Vercel's zero-config Hono support runs the default export of the entry file, which re-exports the app from `src/app.ts`. Locally the same app is served by `src/dev.ts`.

Vercel only builds `apps/api`, and the workspace packages (`@mtg-vault/shared`, `@mtg-vault/db`) export TypeScript source, so a plain deploy crashed with `ERR_MODULE_NOT_FOUND`. `apps/api/vercel.json` therefore runs `pnpm build`, which bundles the app with tsup (`tsup.config.ts`) into `apps/api/index.js` (git-ignored). That file, found at the root, is the entry point Vercel runs; third-party dependencies stay external, which is why `postgres` is a direct dependency of the API. Build it locally with `pnpm --filter @mtg-vault/api build`.

## Endpoints

### `GET /health`

Returns `{ "ok": true }`.

### `GET /cards/search`

Fuzzy search of oracle cards by name, backed by the `pg_trgm` index on `cards.name`.

| Parameter | Required | Description |
|---|---|---|
| `q` | yes | Name or fragment, 2–100 characters. Typos are tolerated (`lightnin bolt`). |
| `limit` | no | 1–50, default 20 |
| `type` | no | Substring of the type line, for example `instant` |
| `colors` | no | Comma-separated color identity the card must include, from `W,U,B,R,G` |

Ordering: exact name, then names starting with `q`, then trigram similarity.

Each result carries `image`: the `small`, `normal` and `artCrop` URLs of the **most recent printing that has an image** (or `null`). They are Scryfall URLs hotlinked by the clients, not files we store. The printing is picked with a `lateral` join that runs only for the rows kept by `limit`.

```json
{ "results": [
  { "oracleId": "4457ed35-…", "name": "Lightning Bolt", "manaCost": "{R}", "typeLine": "Instant", "similarity": 0.81,
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

Verified manually against the Neon catalog (120k printings): a typo query, the `type` and `colors` filters, and the `400` cases. Unit tests (`app.test.ts`, `cards.test.ts`) cover validation, status codes, the response mapping and LIKE escaping with the data layer mocked; the SQL itself is not covered by automated tests.
