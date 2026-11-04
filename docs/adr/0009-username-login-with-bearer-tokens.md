# ADR 0009 — Username login with Bearer tokens

**Status:** accepted

## Context
[ADR 0008](0008-users-collection-binders-decks.md) chose username and password for the first version, on Better Auth ([ADR 0004](0004-hono-api-and-better-auth.md)). Two constraints shape how sessions travel:

- The web app (`mtg-vault-web.vercel.app`) and the API (`mtg-vault-api.vercel.app`) are different sites: `vercel.app` is on the public suffix list. Session cookies would be third-party cookies, which browsers increasingly block.
- Electron must use the same API ([ADR 0002](0002-spa-for-electron-reuse.md)).

## Decision
- Better Auth runs inside the API, mounted at `/api/auth/*`, with `emailAndPassword`, the `username` plugin and the **`bearer` plugin**.
- A session is a token sent as `Authorization: Bearer <token>`. Sign-up and sign-in return it in the `set-auth-token` response header, which CORS exposes. The web app keeps it in `localStorage` (the only copy; no cookie is needed) and sends it on each request.
- Accounts are created through `POST /auth/register` (`{ username, password }`), which calls Better Auth's sign-up with the synthetic email from ADR 0008. Better Auth's own `POST /api/auth/sign-up/email` is closed (404), so no account can exist without a username.
- Sign-in uses `POST /api/auth/sign-in/username`; sign-out `POST /api/auth/sign-out`; `GET /me` returns the current user.
- Usernames: 3–30 characters, letters, digits, `_` and `.`, case-insensitive (stored lower-case, the original is kept for display). Passwords: 8–128 characters, hashed by Better Auth (scrypt).
- A database hook creates the user's single collection in the same step as the account.
- Configuration: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and the existing `CORS_ORIGINS` (also the trusted origins).

## Consequences
- Works cross-site and in Electron without cookies.
- A token in `localStorage` can be read by any script running on the page (XSS). Accepted for now; the web app has no user-generated HTML. Revisit with a stricter setup if that changes.
- Better Auth's built-in rate limiting keeps its counters in memory, which does not hold across serverless instances. Brute-force protection is therefore weak until it is moved to a shared store (planned).
- No email means no password recovery or email verification yet.
- `better-auth` pulls in `kysely` as an optional peer, which made pnpm install two copies of `drizzle-orm` and broke types between packages. `kysely` is declared in `packages/db` and `apps/jobs` so all packages share one copy.
