# Vercel

Vercel hosts the web app (and later the API). See [stack.md](stack.md) for the overall deployment picture.

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

## Deployment limit (Hobby plan)

The Hobby plan caps deployments per day. On 2026-11-04 both projects answered **"Deployment rate limited — retry in 24 hours"** and the merge of the decks PR (#34) did not deploy. The cause was volume: every push to a pull request built a preview of both projects, on top of the production builds.

To stay under the limit, each project has an `ignoreCommand` in its `vercel.json` (`apps/web/vercel.json`, `apps/api/vercel.json`):
- **Only `main` is built.** Pull request branches get no preview (the `Vercel` status on a PR shows as skipped or canceled; it is not a required check).
- **On `main`, a push is built only if it changed something the project uses:** the project's own folder, `packages/shared` (and `packages/db` for the API), `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml`. A documentation-only merge deploys nothing.

Consequences: there is no per-PR preview URL any more; to try a change before merging, run it locally. To deploy a change that the rule skips (for example a variable change), use **Redeploy** on the latest deployment in the Vercel dashboard or `vercel redeploy <url>`.

**Recovering from a rate limit:** nothing can be deployed until the limit resets (24 hours after the message). Then redeploy `main`: in the dashboard, open the project and use *Redeploy* on the newest production deployment, or merge a change in `apps/web` or `apps/api`. Check that production runs the latest `main` by calling a route that only exists in it.

## Agent tooling

The Vercel CLI, the Vercel plugin for Claude Code and the Vercel MCP server (`https://mcp.vercel.com`, user scope) were set up following https://vercel.com/get-started.md. The MCP server needs a one-time OAuth sign-in from `/mcp`.

## Status (2026-11-04)

- **Web:** https://mtg-vault-web.vercel.app is public (HTTP 200). Only the per-deployment URLs (`*-jbxrajas-projects.vercel.app`) sit behind Vercel Authentication and redirect to a Vercel sign-in (HTTP 302); that is expected.
- **API:** https://mtg-vault-api.vercel.app is live. Checked in production: `/health` returns 200, `/cards/search?q=lightnin bolt` returns Lightning Bolt first, and a request with `Origin: https://mtg-vault-web.vercel.app` gets the matching `Access-Control-Allow-Origin`. `DATABASE_URL` and `CORS_ORIGINS` are set (as Vercel secrets, so they are hidden in the dashboard).
- **Web to API:** the web app does not call the API yet; it will need the API URL as a build variable.
- Redeploy after changing a variable: `vercel redeploy <deployment-url>` from `apps/api`.
