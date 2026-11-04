# Vercel

Vercel hosts the web app and the API. See [stack.md](stack.md) for the overall deployment picture.

## Web project (done)

| Item | Value |
|---|---|
| Project | `mtg-vault-web` (team `jbxrajas-projects`, Hobby plan) |
| Root directory | `apps/web` |
| Framework preset | Vite |
| Git | Connected to `JBxrajas/mtg-vault`; production branch `main` |

Created with the Vercel CLI from the repo root:

```bash
npm install --global vercel@latest
vercel login
vercel link --yes --project mtg-vault-web   # creates the project and connects the GitHub repo
```

The root directory and framework were then set through the project API (`vercel api /v9/projects/<id> -X PATCH -F rootDirectory=apps/web -F framework=vite`).

`vercel link` writes `.vercel/` (project link) and adds `VERCEL_OIDC_TOKEN` to `.env.local`; both are git-ignored. It also appends `.vercel` and `.env*` to `.gitignore`: do not keep the `.env*` line, because it overrides the `!.env.example` exception.

## API project

| Item | Value |
|---|---|
| Project | `mtg-vault-api` (same team) |
| Root directory | `apps/api` |
| Framework preset | Hono (zero config; entry point `src/index.ts`) |
| Git | Connected to `JBxrajas/mtg-vault`; production branch `main` |

It was created with `vercel link --yes --project mtg-vault-api` run **inside `apps/api`**, so the link lives in `apps/api/.vercel/` (git-ignored) and does not replace the web project's link at the repo root. Root directory and preset were set through the project API, as for the web project. Delete the `apps/api/.gitignore` that `vercel link` creates; the root one already covers it.

The API is bundled before deploy (`apps/api/vercel.json` → `pnpm build`, tsup) because the workspace packages export TypeScript; see [apps/api/README.md](../apps/api/README.md#deployment).

Environment variables (Production). They were set by the repository owner, because storing secrets from the agent session is blocked:

```bash
cd apps/api
grep '^DATABASE_URL=' ../../.env.local | cut -d= -f2- | tr -d '"' | vercel env add DATABASE_URL production --sensitive
echo https://mtg-vault-web.vercel.app | vercel env add CORS_ORIGINS production
```

Auth variables (Production), also set by the repository owner (set on 2026-11-04). The secret is generated on the spot and never printed:

```bash
cd apps/api
openssl rand -base64 32 | vercel env add BETTER_AUTH_SECRET production --sensitive
echo https://mtg-vault-api.vercel.app | vercel env add BETTER_AUTH_URL production
vercel redeploy <latest production deployment url>
```

Verified in production on 2026-11-04 with a throwaway account (deleted afterwards): register (200, `set-auth-token` exposed to the web origin), `GET /me` with the token (200) and without (401), wrong password (401), sign-in (200), sign-out (200) and the old token rejected (401). To redeploy after changing a variable, pass the latest production deployment URL from `vercel ls mtg-vault-api` to `vercel redeploy`.

## Function region

The database is on Neon in `aws-us-west-2` (Oregon). Vercel functions default to `iad1` (Virginia), so every query crossed the country: a collection change makes about ten of them one after another, and the buttons felt very slow. `apps/api/vercel.json` pins `"regions": ["pdx1"]` (Portland), the closest Vercel region. If the Neon project ever moves, move the function region with it. The region a response came from is in its `x-vercel-id` header (`sfo1::pdx1::…`: edge, then function).

## Deployment limit (Hobby plan)

The Hobby plan allows **100 deployments per 24 hours** (the error says `api-deployments-free-per-day`; the Git integration shows "Deployment rate limited — retry in 24 hours"). It was hit on 2026-11-04, when merges stopped deploying. Counting with the API (`vercel api "/v6/deployments?limit=100&teamId=…"`), there were **155 deployments in 24 hours**, almost all previews: every push to a pull request creates one per project, and a deployment that is cancelled **still counts**, as do the ones made by hand with `vercel deploy`. A documentation-only merge to `main` also created two (one per project), cancelled at once by the old `ignoreCommand`.

**How it is kept low now** ([ADR 0012](adr/0012-deploy-from-github-actions.md)):
- **Vercel's Git deployments are off** for both projects (`git.deploymentEnabled: false` in `apps/web/vercel.json` and `apps/api/vercel.json`), so neither a pull request nor a merge creates anything on its own.
- **GitHub Actions deploys to production** after a push to `main`: `.github/workflows/deploy-web.yml` and `deploy-api.yml`, each only when a file the project uses changed (see the paths in the workflows and the ADR). Documentation, tests, the other project, `package.json` version bumps and release-please commits deploy nothing and cost nothing. Each run ends by checking that the production URL answers.
- To deploy without a code change (an environment variable changed, a setting): Actions → *deploy-web* or *deploy-api* → *Run workflow*, or `vercel redeploy <url>`.
- The token is the `VERCEL_TOKEN` Actions secret (create it at https://vercel.com/account/tokens, then `gh secret set VERCEL_TOKEN`). If a run fails saying the secret is not set, or with an authorization error, it expired or was revoked: create a new one.
- No per-pull-request preview URL: to try a change before merging, run it locally.
- To check the count: list the deployments with the API as above and count those created in the last 24 hours. A Claude Code hook does this before every `vercel deploy` that Claude runs and blocks it near the limit ([ADR 0011](adr/0011-vercel-deploy-guard-hook.md)).

**Recovering from a rate limit:** the count is a rolling 24 hours, so deployments free up as the oldest ones age out; retrying earlier fails the same way. When there is room, run the workflow by hand (or merge a relevant change) and check that production runs the latest `main` by calling a route that only exists in it.

## Agent tooling

The Vercel CLI, the Vercel plugin for Claude Code and the Vercel MCP server (`https://mcp.vercel.com`, user scope) were set up following https://vercel.com/get-started.md. The MCP server needs a one-time OAuth sign-in from `/mcp`.

## Status (2026-11-04)

- **Web:** https://mtg-vault-web.vercel.app is public. Only the per-deployment URLs (`*-jbxrajas-projects.vercel.app`) sit behind Vercel Authentication and redirect to a Vercel sign-in (HTTP 302); that is expected. The web app calls the API at `https://mtg-vault-api.vercel.app` (`VITE_API_URL`, default in a production build).
- **API:** https://mtg-vault-api.vercel.app, running in `pdx1` next to the database. `DATABASE_URL`, `CORS_ORIGINS`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are set (as Vercel secrets, so they are hidden in the dashboard).
- **Deploys:** from GitHub Actions after a merge to `main` ([ADR 0012](adr/0012-deploy-from-github-actions.md)); while the daily limit was active on 2026-11-04 they were made by hand with `vercel deploy --prod` from `main`, with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` set to the project's ids (the root directory is a project setting, so it is deployed from the repository root, not from `apps/web`). On the evening of 2026-11-04 the API was up to date with `main`; the web was behind by the deck list import and export, the printing choice for the background art and the fix to the deck tabs, waiting for the limit to reset.
- Redeploy after changing a variable: `vercel redeploy <deployment-url>` from `apps/api`.
