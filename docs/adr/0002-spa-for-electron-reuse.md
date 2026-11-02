# ADR 0002 — Vite SPA instead of Next.js

**Status:** accepted

## Context
The web app will be published on Vercel and, later, the same UI will be packaged in Electron. The app sits behind a login, so SEO and SSR add little.

## Decision
Frontend as a SPA with Vite + React + TanStack Router and Query. The API is a separate service (Hono). Electron will load the same build.

## Consequences
- A single build serves web and desktop.
- Public pages that need SEO (shared decks) will need a separate solution if required.
- Auth must support both cookies and Bearer tokens.
