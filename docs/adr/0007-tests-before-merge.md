# ADR 0007 — Unit tests run before merge and ship with features

**Status:** accepted

## Context
`main` must always be stable, and the project already enforces docs with a hook and a PR checklist. Behavior changes need the same kind of guard: tests that run automatically, and a habit of adding them with each feature.

## Decision
- Unit tests use Vitest and live next to the code as `*.test.ts`. They must not need a database or the network.
- CI runs them as a separate `test` job (`.github/workflows/ci.yml`), parallel to `typecheck`.
- Once the job exists on `main`, `test` is added to the required status checks of the `main` branch protection, next to `conventional-title` and `typecheck`.
- New behavior ships with tests whenever it can be tested. The rule is in CONTRIBUTING.md and the PR template checklist; the commit hook ([ADR 0006](0006-docs-check-commit-hook.md)) reminds Claude when `src/` files change without any test file. The hook only reminds; it never blocks, because some changes (config, wiring, docs) have nothing to unit test.

## Consequences
- A failing test blocks the merge, like a type error does.
- Data-layer code (for example the SQL in `searchCards`) is not covered by unit tests. Database-backed tests need their own decision (a throwaway Neon branch or a local Postgres) and are out of scope for now.
- Like the docs hook, the reminder only applies to commits made through Claude Code.

## Update (2026-11-04)
Component tests now exist for the web app: `*.test.tsx` files run in jsdom with Testing Library, and `renderPage` in `apps/web/src/test-utils.tsx` provides the router and query client. The first round of them found a real bug (the quantity field could not be cleared and retyped). Layout and styling are still not covered, and neither is the SQL in the API; the earlier note about database-backed tests stands.
