# ADR 0012 — Deploy to Vercel from GitHub Actions, only when something changed

**Status:** accepted

## Context
The Hobby plan allows 100 deployments per rolling 24 hours and every deployment counts, cancelled ones included ([ADR 0011](0011-vercel-deploy-guard-hook.md), [vercel.md](../vercel.md#deployment-limit-hobby-plan)). With Vercel's Git integration, each merge to `main` creates one deployment per project, even when the `ignoreCommand` then cancels it: a documentation-only merge cost two. Pull request previews had already been turned off with `git.deploymentEnabled`.

## Decision
- **Vercel's Git deployments are off** for both projects (`"git": { "deploymentEnabled": false }` in `apps/web/vercel.json` and `apps/api/vercel.json`). Nothing in Vercel deploys on its own. The `ignoreCommand` is removed: it only existed to cancel deployments that should not have been created.
- **Two GitHub Actions workflows deploy to production** after a push to `main`, each only when a file the project uses changed (`paths` filter): `deploy-web.yml` and `deploy-api.yml`, both calling the reusable `deploy-project.yml`. A push that changes none of those paths (documentation, tests, other project, README, release-please's version and changelog commits) creates no deployment at all.
- **What each one watches:** the web app: `apps/web/src/**`, `index.html`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, `packages/shared/src/**`, `pnpm-lock.yaml`. The API: `apps/api/src/**`, `tsconfig.json`, `tsup.config.ts`, `vercel.json`, `packages/shared/src/**`, `packages/db/src/**`, `pnpm-lock.yaml`. Both also watch their own workflow files. `package.json` files are left out on purpose, so a version bump by release-please does not deploy; dependency changes arrive through the lockfile.
- **How it deploys:** `vercel deploy --prod` from the repository root with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (the project's root directory is a Vercel setting, so Vercel installs and builds remotely), then a `curl` with retries that the production URL answers (`/health` for the API). The CLI version is pinned.
- **Credentials:** a `VERCEL_TOKEN` Actions secret, set by the repository owner. The team and project ids are not secrets and live in the workflows. If the token is missing, the job fails with a message saying how to set it, instead of skipping.
- **Order and manual runs:** one deploy per project at a time (`concurrency`, no cancelling of a running deploy). Both workflows have `workflow_dispatch` (Actions → Run workflow) to deploy without a code change, for example after changing an environment variable.

## Consequences
- Merging costs one deployment per project whose files changed, and nothing otherwise. With a handful of merges a day that is far below 100.
- A change that needs a deploy but touches none of the watched paths (an environment variable, a setting, `package.json` scripts) needs a manual run. If a project starts to use a new kind of file, add its path to the workflow.
- If the token expires or is revoked, merges stop deploying and the run goes red. Rotate it (vercel.com/account/tokens, then `gh secret set VERCEL_TOKEN`).
- Vercel still shows no per-pull-request preview, as before ([vercel.md](../vercel.md)).
- A broken workflow is a new way for a merge not to reach production; the production check at the end of each run makes that visible.
- Manual deploys with the CLI still work and still count; the guard of ADR 0011 covers the ones Claude runs.
