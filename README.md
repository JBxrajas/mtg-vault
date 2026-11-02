# mtg-vault

Plataforma para registrar y gestionar colecciones de Magic: The Gathering (estilo Moxfield): altas, bajas, precios con histórico y, más adelante, escaneo de cartas con cámara.

## Estado

Fase 1 — esqueleto del monorepo y base de conocimiento. Ver [docs/plan.md](docs/plan.md).

## Stack

TypeScript en todo · Vite + React (web) · Hono (API) · Postgres en Neon · Drizzle · Zod · Better Auth · Vercel · GitHub Actions para jobs · Electron (fase posterior).

Detalle y justificación en [docs/stack.md](docs/stack.md) y [docs/adr/](docs/adr/).

## Estructura

```
apps/api        API Hono (Vercel Functions)
apps/web        SPA Vite + React (Vercel)
apps/desktop    Electron (fase posterior)
packages/shared Esquemas Zod y tipos compartidos
docs/           Base de conocimiento, ADRs y plan
.github/        CI y jobs programados (importación y precios)
```

## Requisitos

- Node.js 22 LTS
- pnpm 9+

```bash
pnpm install
pnpm dev:api
```

## Documentación

- [docs/README.md](docs/README.md) — índice de la base de conocimiento
- [docs/plan.md](docs/plan.md) — plan por fases
- [docs/stack.md](docs/stack.md) — stack y despliegue
- [docs/apis.md](docs/apis.md) — APIs externas (Scryfall, MTGJSON, …)
- [docs/glossary.md](docs/glossary.md) — glosario de MTG y del modelo de datos
