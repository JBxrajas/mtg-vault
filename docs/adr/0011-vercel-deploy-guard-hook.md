# ADR 0011 — Guard against the Vercel deployment limit

**Status:** accepted

## Context
The Hobby plan allows 100 deployments per rolling 24 hours, and every deployment counts: the previews that the `ignoreCommand` cancels, the production deployments that a documentation-only merge to `main` creates and cancels (two per merge, one per project), and the ones made by hand with `vercel deploy`. On 2026-11-04 there were 155 in 24 hours and the web could not be deployed for most of a day (see [vercel.md](../vercel.md#deployment-limit-hobby-plan)). Pull request branches were fixed at the source with `git.deploymentEnabled`; what remains are merges to `main` and manual deploys.

## Decision
A Claude Code project hook (`PreToolUse` on `Bash`, next to the docs hook of [ADR 0006](0006-docs-check-commit-hook.md)) runs `.claude/hooks/vercel-deploy-guard.sh` before any `vercel deploy`, `vercel redeploy` or `vercel --prod`:
- It counts the deployments of the last 24 hours with the Vercel API (`vercel api`, the team id from `VERCEL_ORG_ID` in the command or from a linked project).
- At **99 or more** it **denies** the command and says how many are used, how many hours until a slot opens, and at what time (UTC). Below that it allows it and adds "N of 100 used" to Claude's context, with a warning from 90.
- It matches the command only where `vercel` is the command being run (start, after `;`, `&`, `|`, `(` or a line break, behind `VAR=value`, `npx` or `pnpm exec`), so commit messages or `echo` that mention it are not touched.
- **It fails open:** with no CLI, no sign-in, no team id or an API error, the deploy is allowed and the note says the count was not checked. A broken guard must not become a second reason not to deploy.
- **It cannot be switched off from the command.** The docs hook has a `NO_DOCS_NEEDED` prefix, but an override that Claude can type itself stops nothing. This one is turned off only with `VERCEL_DEPLOY_GUARD=off` in the environment Claude Code runs in, which is the owner's to set.

The script is tested (`.claude/hooks/vercel-deploy-guard.test.ts`, with a fake `vercel` on the PATH): which commands it reads, the count and the 24-hour window, the threshold, the wait time, the override, and each way of failing open.

## Consequences
- A deploy that Vercel would reject is stopped before it is tried, with the time to retry, and every deploy shows how much of the day is left.
- **It only covers commands Claude runs.** A merge made in the GitHub UI, or by anyone else, still creates two deployments per merge on `main` (one per project), built or cancelled. Merging in batches is the only mitigation until deploys move out of Vercel's Git integration.
- The real fix for that is to deploy from a GitHub Actions workflow with `paths` filters (a documentation-only push would then create nothing) and turn the Git deployments of `main` off. It needs a `VERCEL_TOKEN` secret in GitHub, which only the owner can set, so it is a separate decision and is not done.
- Like the docs hook, it needs the Claude Code session to have loaded `.claude/settings.json`; a session started before the change must reload hooks (`/hooks`) or restart.
