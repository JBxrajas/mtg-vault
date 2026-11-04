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

Deployed as its own Vercel project, `mtg-vault-api` (root `apps/api`, Hono preset); see [docs/vercel.md](../../docs/vercel.md). Vercel's zero-config Hono support runs the default export of `src/index.ts`, which re-exports the app from `src/app.ts`. Locally the same app is served by `src/dev.ts`.

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

```json
{ "results": [
  { "oracleId": "4457ed35-…", "name": "Lightning Bolt", "manaCost": "{R}", "typeLine": "Instant", "similarity": 0.81 }
] }
```

Invalid parameters return `400` with the Zod issues. The query schema lives in `packages/shared` (`cardSearchQuerySchema`) so web and desktop can reuse it.

Verified manually against the Neon catalog (120k printings): a typo query, the `type` and `colors` filters, and the `400` cases. Unit tests (`app.test.ts`, `cards.test.ts`) cover validation, the response shape and LIKE escaping with the data layer mocked; the SQL itself is not covered by automated tests.
