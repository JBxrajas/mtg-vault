# ADR 0006 — Docs check before every commit

**Status:** accepted

## Context
The project rule is "implemented means documented". A rule that depends on remembering it gets skipped, especially when most commits are produced through Claude Code.

## Decision
A Claude Code project hook (`PreToolUse` on `Bash`) runs `.claude/hooks/docs-check.sh` whenever a command contains `git commit`:
- it injects a reminder to review and update the docs;
- it denies the commit when code or config files changed in the working tree but no documentation file did, unless the command carries the explicit `NO_DOCS_NEEDED` override.

The check looks at the working tree (`git status`) rather than the index, because commits are usually chained as `git add -A && git commit`, so nothing is staged yet when the hook runs.

## Consequences
- Code changes without docs are stopped at commit time instead of in review.
- The check is a heuristic: it only verifies that *some* documentation file changed, not that the right one did. The reminder and the PR checklist cover the rest.
- It does not apply to commits made outside Claude Code (plain terminal). A git `pre-commit` hook could extend it later.
- Hook files are committed, so changes to them go through a PR like any other code.
