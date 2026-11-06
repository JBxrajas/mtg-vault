---
name: new-ui-feature
description: Checklist for adding or changing a screen or control in the mtg-vault web app (apps/web) - messages in both languages, component test, docs, layout check. Use whenever a UI change is requested.
---

# New UI feature checklist

1. **Find the pattern first**: read the nearest component and its test (`apps/web/src/*.tsx`, `*.test.tsx`) and reuse existing classes in `styles.css` and tokens (`--text`, `--surface`, `--border`, `--primary`, `--accent`) instead of inventing new ones. Dark mode and the art background (`:root[data-art]`) must stay readable.
2. **Text**: English key in `apps/web/src/messages/en.ts`, same key in `es.ts`. Spanish must contain every English key. Use `t("key", { vars })`; never hardcode strings.
3. **Data**: API shape lives in `packages/shared`; the API implementation in `apps/api/src`. A new field means shared type, API, tests, `apps/api/README.md`.
4. **Tests**: component test next to the screen (`renderPage` from `test-utils.tsx`, mock the network module). Assert behavior and the Spanish case when copy matters.
5. **Layout**: if it depends on position, sticky, overlap or overflow, add an `e2e/` Playwright check at phone (360/390) and desktop width. Keep e2e few.
6. **Accessibility**: real `<button>`s, labels, `aria-pressed` for toggles, keyboard works, no color-only meaning.
7. **Docs**: `apps/web/README.md` section for the screen, `docs/plan.md` status. The docs hook blocks commits without them.
8. Finish with `pnpm test`, `pnpm -r typecheck`, then the `ship-pr` skill. Say plainly what was not checked in a real browser or phone.
