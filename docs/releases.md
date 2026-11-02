# Branches, versioning and releases

## Model

- **Trunk-based, no `develop` branch.** `main` is always stable; everything enters through short-lived branches and pull requests.
- **Versioning:** [SemVer](https://semver.org/), starting at `0.0.0`. While the version is `0.x`, breaking changes bump the minor version. `1.0.0` is cut manually when the app is ready for real use.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/). PRs are squash-merged, so the PR title is the commit message on `main`.
- **Tooling:** [release-please](https://github.com/googleapis/release-please) running in GitHub Actions.

Branch naming and commit types are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## How a release happens

1. A PR is merged into `main`.
2. The `release-please` workflow reads the new commits and opens (or updates) a PR titled `chore(main): release X.Y.Z`. It bumps the version in `package.json` and updates `CHANGELOG.md`.
3. When that release PR is merged, release-please creates the `vX.Y.Z` tag and a GitHub Release with the changelog.

Only `feat`, `fix`, `perf` and breaking changes trigger a release; `docs`, `chore` and similar do not.

## Files

| File | Purpose |
|---|---|
| `release-please-config.json` | release-please settings (node release type, pre-1.0 bump rules) |
| `.release-please-manifest.json` | Current released version (`0.0.0` until the first release) |
| `.github/workflows/release-please.yml` | Runs release-please on every push to `main` |
| `.github/workflows/pr-title.yml` | Fails a PR whose title is not a Conventional Commit |
| `.github/pull_request_template.md` | PR checklist, including the "implemented means documented" rule |

The root `package.json` holds the single project version; workspace packages are private and not versioned separately.

## GitHub settings (already applied)

These are repository settings and are not stored in the code. They were applied on 2026-11-01:

- **Actions → Workflow permissions:** "Allow GitHub Actions to create and approve pull requests" is enabled, so release-please can open its PR.
- **Merging:** only squash merge is allowed (merge commits and rebase are disabled). The squash commit title is the PR title and the body is blank. Merged branches are deleted automatically.
- **Branch protection on `main`:** changes must come through a pull request and the `conventional-title` check must pass. Force pushes and branch deletion are blocked. Admins are not enforced, so the owner can still bypass the rules in an emergency. No approving review is required (single developer).

If the settings are lost or the repository is recreated, reapply them with `gh api` or from Settings → Branches / General.
