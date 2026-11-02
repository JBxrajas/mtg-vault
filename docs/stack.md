# Stack

| Capa | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript | Tipos compartidos entre API, web y desktop |
| Web | Vite + React + TanStack Router y Query | SPA pura, reutilizable en Electron |
| API | Hono | Corre en Vercel Functions y en Node normal |
| DB | PostgreSQL en Neon | Serverless, plan gratuito, integración con Vercel; `pg_trgm` para búsqueda por nombre y JSONB para el dato crudo de Scryfall |
| ORM | Drizzle | Ligero, migraciones claras |
| Validación | Zod (`packages/shared`) | Mismos esquemas en todas las capas |
| Auth | Better Auth (email y contraseña) | Vive en nuestra DB, sin servicio externo |
| Jobs | GitHub Actions (cron) | Sin límite de timeout; gratis |
| Desktop | Electron (fase posterior) | Reutiliza el build de la web |
| Monorepo | pnpm workspaces | Simple |

## Estructura

```
apps/api        Hono
apps/web        Vite + React
apps/desktop    Electron
packages/shared Zod, tipos, utilidades
```

## Despliegue

- **Web y API:** Vercel (dos proyectos o uno con rutas; se decide en la fase 1).
- **DB:** Neon (integración nativa de Vercel).
- **Importación de Scryfall y snapshots de precios:** GitHub Actions con cron, escribiendo directo a Neon. Las funciones de Vercel tienen límite de tiempo y el bulk de Scryfall pesa cientos de MB.
- **Vercel Cron:** solo tareas ligeras (por ejemplo, alertas de precio).

## Electron

- La web debe seguir siendo una SPA sin SSR.
- La auth debe funcionar con cookies y con token Bearer, para que web y Electron compartan API.
- Modo offline (SQLite local) queda fuera del alcance inicial.
