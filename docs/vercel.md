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

## Agent tooling

The Vercel CLI, the Vercel plugin for Claude Code and the Vercel MCP server (`https://mcp.vercel.com`, user scope) were set up following https://vercel.com/get-started.md. The MCP server needs a one-time OAuth sign-in from `/mcp`.

## Not done yet

- **First deployment:** none has been triggered from the CLI; Vercel deploys on pushes now that Git is connected. Check the first build before relying on it.
- **API project:** created later, when the API has something to serve.
- **Environment variables:** the web app needs none yet. The API will need `DATABASE_URL` (see [neon.md](neon.md)).
