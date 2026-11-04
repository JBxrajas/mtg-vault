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

## Agent tooling

The Vercel CLI, the Vercel plugin for Claude Code and the Vercel MCP server (`https://mcp.vercel.com`, user scope) were set up following https://vercel.com/get-started.md. The MCP server needs a one-time OAuth sign-in from `/mcp`.

## Status (2026-11-04)

- **Web:** https://mtg-vault-web.vercel.app is public (HTTP 200). Only the per-deployment URLs (`*-jbxrajas-projects.vercel.app`) sit behind Vercel Authentication and redirect to a Vercel sign-in (HTTP 302); that is expected.
- **API:** https://mtg-vault-api.vercel.app is live. Checked in production: `/health` returns 200, `/cards/search?q=lightnin bolt` returns Lightning Bolt first, and a request with `Origin: https://mtg-vault-web.vercel.app` gets the matching `Access-Control-Allow-Origin`. `DATABASE_URL` and `CORS_ORIGINS` are set (as Vercel secrets, so they are hidden in the dashboard).
- **Web to API:** the web app does not call the API yet; it will need the API URL as a build variable.
- Redeploy after changing a variable: `vercel redeploy <deployment-url>` from `apps/api`.
