# apps/api

Hono API. Runs on plain Node locally and, later, on Vercel Functions (no API project exists on Vercel yet).

```bash
pnpm --filter @mtg-vault/api dev   # http://localhost:3001; loads ../../.env.local if present
```

Needs `DATABASE_URL` (the pooled Neon connection, see [docs/neon.md](../../docs/neon.md)).

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
