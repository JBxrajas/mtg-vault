# ADR 0003 — Importación y precios en GitHub Actions

**Estado:** aceptada

## Contexto
El bulk data de Scryfall pesa cientos de MB y las funciones de Vercel tienen límites de tiempo y no admiten procesos de larga duración. Scryfall no guarda histórico de precios, así que hay que guardar un snapshot diario.

## Decisión
La importación del catálogo y el snapshot diario de precios corren como workflows de GitHub Actions con cron, escribiendo directamente a Neon. Vercel Cron se reserva para tareas ligeras.

## Consecuencias
- Sin límite práctico de tiempo y sin coste.
- La cadena de conexión a Neon se guarda como secreto del repositorio.
- Los cron de GitHub pueden retrasarse unos minutos; el snapshot no necesita puntualidad exacta.
