# ADR 0001 — TypeScript in a pnpm monorepo

**Status:** accepted

## Context
A single developer builds the API, the web app and, later, a desktop app. Types and validation rules would otherwise be repeated in every layer.

## Decision
Everything in TypeScript, in a pnpm monorepo, with `packages/shared` (Zod schemas and types) used by the API, web and desktop.

## Consequences
- A schema change propagates to every layer as type errors.
- Workspace dependencies must be kept up to date.
