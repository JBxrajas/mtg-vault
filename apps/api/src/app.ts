import { zValidator } from "@hono/zod-validator";
import { cardSearchQuerySchema, oracleIdParamSchema } from "@mtg-vault/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { listPrintings, searchCards } from "./cards.js";

export const app = new Hono();

/** Origins allowed to call the API from a browser, comma-separated in `CORS_ORIGINS`. */
export const defaultOrigins = ["http://localhost:5173"];
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()) ?? defaultOrigins;
      return allowed.includes(origin) ? origin : null;
    },
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/cards/search", zValidator("query", cardSearchQuerySchema), async (c) => {
  const results = await searchCards(c.req.valid("query"));
  return c.json({ results });
});

app.get("/cards/:oracleId/printings", zValidator("param", oracleIdParamSchema), async (c) => {
  const printings = await listPrintings(c.req.valid("param").oracleId);
  if (printings.length === 0) return c.json({ error: "Card not found" }, 404);
  return c.json({ printings });
});
