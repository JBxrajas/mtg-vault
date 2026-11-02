# Plan por fases

Estado: ☐ pendiente · ◐ en curso · ☑ hecho

## Fase 1 — Esqueleto y base de conocimiento ◐
- ☑ Monorepo pnpm (`apps/api`, `apps/web`, `apps/desktop`, `packages/shared`)
- ☑ Base de conocimiento y ADRs
- ☐ `apps/web` con Vite + React + TanStack Router/Query
- ☐ Proyecto en Vercel (web y API) y base de datos Neon
- ☐ CI básico (typecheck) en GitHub Actions

## Fase 2 — Catálogo ☐
- Esquema Drizzle: `set`, `card` (oracle), `printing`
- Job de GitHub Actions: importar bulk data de Scryfall a Neon
- Endpoint de búsqueda por nombre (`pg_trgm`) y filtros básicos

## Fase 3 — Colección y usuarios ☐
- Auth con email y contraseña (Better Auth)
- Colecciones y mazos; altas, bajas y edición de entradas (cantidad, foil, condición, idioma, precio de compra)
- Importar y exportar CSV (Moxfield, Deckbox, Manabox)

## Fase 4 — Precios ☐
- Job diario: snapshot de precios en tabla `price_snapshot`
- Gráficos de evolución y valor total de la colección
- Alertas de subidas y bajadas

## Fase 5 — Escaneo ☐
- Subida de foto con OCR (nombre y número de colección) y búsqueda difusa en Scryfall
- Cámara en vivo y hash perceptual (pHash) contra imágenes de Scryfall para distinguir ediciones

## Fase 6 — Electron y extras ☐
- `apps/desktop` con Electron cargando el build de `apps/web`
- Constructor de mazos con validación por formato, estadísticas, wishlist, listas públicas
