# ADR 0001 — TypeScript en un monorepo pnpm

**Estado:** aceptada

## Contexto
Una sola persona desarrolla API, web y más adelante una app de escritorio. Los tipos y las reglas de validación se repiten en todas las capas.

## Decisión
Todo en TypeScript, en un monorepo pnpm con `packages/shared` (esquemas Zod y tipos) usado por API, web y desktop.

## Consecuencias
- Un cambio en un esquema se propaga a todas las capas con errores de tipo.
- Hay que mantener las dependencias de workspace al día.
