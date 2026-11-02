# apps/web

SPA built with Vite + React + TanStack Router and Query.

It must remain a pure SPA (no SSR) so that `apps/desktop` can load the same build. See [ADR 0002](../../docs/adr/0002-spa-for-electron-reuse.md).

- Assets use relative paths (`base: "./"`) and routing uses hash history, so the build also works from `file://` in Electron.
- All UI text is in English.

## Scripts

```bash
pnpm --filter @mtg-vault/web dev        # dev server on http://localhost:5173
pnpm --filter @mtg-vault/web build      # typecheck and production build into dist/
pnpm --filter @mtg-vault/web typecheck
```

## Current state

Only a placeholder home page exists. Collection, search and auth screens come in later phases (see [docs/plan.md](../../docs/plan.md)).
