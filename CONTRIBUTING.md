# Contributing

## Rules

1. **Implemented means documented.** A change is not done until `docs/` (plan status, stack, APIs, ADRs) and the affected READMEs are updated in the same PR.
2. **English only:** code, comments, docs, commit messages, PR text and UI text.
3. **`main` is always stable.** Work happens on a branch and enters `main` through a pull request, squash-merged.

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
