# ADR 0005 — Trunk-based branches, Conventional Commits and release-please

**Status:** accepted

## Context
A single developer needs a lightweight way to version and release the app, with an automatic changelog and no manual tagging. A long-lived `develop` branch adds ceremony without benefit for one person.

## Decision
- Trunk-based development: stable `main`, short-lived `feat/`, `fix/`, `docs/` and `chore/` branches, squash-merged PRs.
- Conventional Commits, enforced on PR titles by CI.
- SemVer, with release-please generating the release PR, changelog, tag and GitHub Release.
- While on `0.x`, breaking changes bump the minor version.

## Consequences
- Releases need no manual versioning or tagging.
- PR titles must be well formed, since they drive the version and changelog.
- The repository needs the "Allow GitHub Actions to create pull requests" setting enabled (done).
- `main` is protected: PR required and the `conventional-title` check must pass; admins are not enforced.
