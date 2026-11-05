# Contributing

## Rules

1. **Implemented means documented.** A change is not done until `docs/` (plan status, stack, APIs, ADRs) and the affected READMEs are updated in the same PR.
2. **New behavior comes with tests** whenever it can be tested (see [Tests](#tests)). `pnpm test` must pass before merging.
3. **English only** for code, comments, docs, commit messages and PR text. The interface is written in English and translated to Spanish in `apps/web/src/messages/` ([ADR 0010](docs/adr/0010-interface-languages.md)): a new UI message goes in both catalogs.
4. **`main` is always stable.** Work happens on a branch and enters `main` through a pull request, squash-merged.

### Docs hook (Claude Code)

The project ships a Claude Code `PreToolUse` hook (`.claude/settings.json` and `.claude/hooks/docs-check.sh`) that runs before any `git commit` issued by Claude:

- It always reminds Claude to review `docs/`, the READMEs and the ADRs and update what the change affects.
- It also reminds Claude to add or update tests when source files under `src/` changed without any `*.test.ts` (a reminder, never a block).
- It **blocks** the commit when code or config changed (`apps/`, `packages/`, `.github/`, `.claude/`, root config files) but no documentation file did.
- If no docs are really affected, the commit can be retried with `NO_DOCS_NEEDED=1` as a prefix (for example `NO_DOCS_NEEDED=1 git commit ...`).

The hook only applies to commits made through Claude Code; the PR template checklist covers everyone else. See [ADR 0006](docs/adr/0006-docs-check-commit-hook.md).

### Vercel deploy guard (Claude Code)

A second `PreToolUse` hook (`.claude/hooks/vercel-deploy-guard.sh`) runs before any `vercel deploy`, `vercel redeploy` or `vercel --prod` issued by Claude. The Hobby plan allows 100 deployments per 24 hours, cancelled ones included, so the hook counts the last 24 hours with the Vercel API and **blocks** the deploy at 99 or more, saying when the next slot opens; below that it only reports the count. It allows the deploy when it cannot count, and it can only be turned off with `VERCEL_DEPLOY_GUARD=off` in the environment Claude Code runs in, not from the command. It does not see the deploys that GitHub Actions makes after a merge, which only run when something the project uses changed ([ADR 0012](docs/adr/0012-deploy-from-github-actions.md)). See [ADR 0011](docs/adr/0011-vercel-deploy-guard-hook.md).

## Branches

| Prefix | Use |
|---|---|
| `feat/` | New functionality |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `chore/` | Tooling, CI, dependencies, refactors |

Example: `feat/scryfall-import`.

## Commits and PR titles

[Conventional Commits](https://www.conventionalcommits.org/). Because PRs are squash-merged, **the PR title becomes the commit on `main`**, and a CI check validates it.

| Type | Effect on the version |
|---|---|
| `feat:` | minor bump (while on `0.x`, this is also the bump used for breaking changes) |
| `fix:`, `perf:` | patch bump |
| `feat!:` or a `BREAKING CHANGE:` footer | breaking change (minor while on `0.x`, major from `1.0.0`) |
| `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `build:` | no release by themselves |

## Releases

See [docs/releases.md](docs/releases.md). In short: merging to `main` makes release-please open or update a release PR; merging that PR creates the tag and the GitHub Release.

## Tests

Run `pnpm test` (Vitest) before opening a PR. CI runs it as the separate `test` job on every PR, and it must pass before merging. Add unit tests next to the code you change, in `*.test.ts` files, and component tests for screens in `*.test.tsx` files (jsdom and Testing Library; see [apps/web/README.md](apps/web/README.md#tests)). A new screen or a change in what a screen does comes with a component test. Unit tests must not touch a real database or the network; mock those modules. Test code that needs a database is not set up yet.

**Browser checks** (`e2e/`, Playwright, `pnpm test:e2e`; first time: `pnpm exec playwright install chromium`) cover what jsdom cannot see: layout, sticky elements, overlap, horizontal overflow, at phone and desktop width. The API is mocked, so they need no server or database. Add one when a change depends on how the page is laid out, not only on what it says. Keep them few: each one costs a browser. The `e2e` CI job runs them on every PR. `pnpm test:coverage` prints coverage; line coverage does not tell you a layout is right (jsdom does no layout), so it is a way to find untested code, not a goal.
