# ADR 0004 — Hono API and Better Auth

**Status:** accepted

## Context
The API must deploy on Vercel and also run on plain Node. Initial authentication is basic (email and password) and must serve both web and Electron.

## Decision
- API built with Hono, which runs the same on Vercel Functions and on Node.
- Auth with Better Auth using email and password, stored in our own Postgres.

## Consequences
- No dependency on an external identity provider.
- If OAuth (Google, GitHub) is wanted later, it can be added as a plugin.
