# ADR 0002 — SPA con Vite en lugar de Next.js

**Estado:** aceptada

## Contexto
Se quiere publicar la web en Vercel y, más adelante, empaquetar la misma interfaz en Electron. La aplicación está detrás de un login, así que el SEO y el SSR aportan poco.

## Decisión
Frontend como SPA con Vite + React + TanStack Router y Query. La API es un servicio aparte (Hono). Electron cargará el mismo build.

## Consecuencias
- Un solo build sirve a web y desktop.
- Las páginas públicas con SEO (mazos compartidos) requerirán una solución aparte si se necesitan.
- La auth debe soportar cookies y token Bearer.
