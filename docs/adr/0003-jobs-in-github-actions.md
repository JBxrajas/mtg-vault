# ADR 0003 — Import and prices run in GitHub Actions

**Status:** accepted

## Context
The Scryfall bulk file is hundreds of MB and Vercel functions have time limits and no long-running processes. Scryfall keeps no price history, so we must store a daily snapshot ourselves.

## Decision
The catalog import and the daily price snapshot run as GitHub Actions workflows on a cron schedule, writing directly to Neon. Vercel Cron is reserved for lightweight tasks.

## Consequences
- No practical time limit and no cost.
- The Neon connection string is stored as a repository secret.
- GitHub cron runs can be delayed by a few minutes; the snapshot does not need exact timing.
