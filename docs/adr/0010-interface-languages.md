# ADR 0010 — Interface languages: English source, Spanish translation

**Status:** accepted

## Context
Until now every word of the interface was written in English, as part of the rule that everything in the repository is in English. Users asked for Spanish. The web app is a Vite 8 + React SPA that must also run inside Electron ([ADR 0002](0002-spa-for-electron-reuse.md)), and its tests assert on visible text.

## Decision
- **English stays the source language** and the fallback. Code, comments, docs, commit messages and PR text remain English. The interface has two languages, English and Spanish, and the Spanish text lives in one file on purpose (`apps/web/src/messages/es.ts`).
- **A small typed catalog, not a library.** `apps/web/src/messages/en.ts` holds every message by key; `es.ts` must have the same keys (`satisfies Record<MessageKey, …>`), so a missing translation fails `typecheck`. Messages use `{name}` placeholders and, where a count matters, `{ one, other }` plurals chosen with `Intl.PluralRules`. `t(key, vars)` and the `useI18n()` hook are in `apps/web/src/i18n.ts`.
- **Language choice:** the saved choice (`localStorage`, key `mtg-vault.locale`), else the browser's language list, else English. A button in the top bar and a *Language* section in *Appearance* change it; the page's `lang` attribute follows.
- **Formats follow the language:** prices use `Intl.NumberFormat` (`$1,234.50` or `1234,50 US$`).
- **Not translated:** card names, type lines and rules text (the catalog data is English from Scryfall), the type filter value (it is matched against English type lines), and messages that come from the server, except the sign-in and sign-up errors we know. Import problem reasons are server messages and stay English.

## Why not Lingui or i18next
Lingui was the first choice (source text stays in the code and an extractor builds the catalogs), but its macros need a Babel step, and `@vitejs/plugin-react` 6 on Vite 8 has no Babel by default: it would mean adding `@rolldown/plugin-babel` to Vite **and** to Vitest. i18next works without a build step but is key-only and adds a dependency for what is a few dozen lines here. The typed catalog gives compile-time completeness, works unchanged in Electron and in tests, and can be replaced by a library later because components only call `t`.

## Consequences
- Adding a message means adding the key to both catalogs; tests check that both have the same keys, the same placeholders and the same plural shape.
- Server error messages are still English in Spanish mode (a known gap). The API should return error codes in a later step.
- A third language is one more file plus an entry in `LOCALES`.
