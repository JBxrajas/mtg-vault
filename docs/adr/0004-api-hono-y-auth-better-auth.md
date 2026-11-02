# ADR 0004 — API con Hono y auth con Better Auth

**Estado:** aceptada

## Contexto
La API debe desplegarse en Vercel y poder ejecutarse en Node normal. La autenticación inicial es básica (email y contraseña), y debe servir a web y Electron.

## Decisión
- API con Hono, que funciona igual en Vercel Functions y en Node.
- Auth con Better Auth y email y contraseña, almacenada en nuestro Postgres.

## Consecuencias
- Sin dependencia de un proveedor de identidad externo.
- Si más adelante se quiere OAuth (Google, GitHub), se añade como plugin.
