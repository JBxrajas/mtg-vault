---
name: ship-pr
description: Take the current working-tree change to main in mtg-vault - branch, Conventional Commit, PR with the project's attribution, wait for CI, squash-merge. Use when the user says to ship, open a PR, merge, or when a change is finished and green locally.
---

# Ship a change to main

Rules come from CONTRIBUTING.md and the user's standing instructions. Follow them in order.

1. **Check locally first**: `pnpm test` and `pnpm -r typecheck` from the repo root. Do not open a PR with either failing.
2. **Docs and tests ship with the change** (the docs hook blocks the commit otherwise): update `docs/` and the affected READMEs; add `*.test.ts(x)` next to changed source; new UI text goes in `apps/web/src/messages/en.ts` and `es.ts`. If truly no docs apply, prefix the commit with `NO_DOCS_NEEDED=1`.
3. **Branch** off an up-to-date `main`: `feat/`, `fix/`, `docs/` or `chore/` + a short kebab name. Never commit on `main`.
4. **Commit** with a Conventional Commit message (the PR title becomes the commit on `main`). English only. End the message with:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
5. **Push and open the PR** with `gh pr create --title "<type>: ..." --body-file <file>`. Write the body to a scratchpad file (What / After merging / Tests). End it with exactly:
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
   To fix a body later use `gh api -X PATCH repos/JBxrajas/mtg-vault/pulls/<n> -F body=@file` (`gh pr edit` fails on the deprecated Projects GraphQL).
6. **Wait for CI**: `gh pr checks <n> --watch` (checks: conventional-title, test, typecheck, e2e). Never use a bare `sleep`.
7. **Merge yourself only when every check is pass** (none fail, pending or cancelled): `gh pr merge <n> --squash`. Never `--admin`. If a check fails, fix it on the branch and push; do not merge around it.
8. **After merging**: `git checkout main && git pull`. Say whether a deploy follows (deploy workflows run only when API/web files changed), whether a migration or catalog import must be run, and that release-please will update its release PR. Do not merge the release PR unless asked.

Never write secrets to GitHub or Vercel, never deploy by hand (deploys are GitHub Actions only).
