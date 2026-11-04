import { zValidator } from "@hono/zod-validator";
import { cardSearchQuerySchema } from "@mtg-vault/shared";
import { Hono } from "hono";
import { searchCards } from "./cards.js";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/cards/search", zValidator("query", cardSearchQuerySchema), async (c) => {
  const results = await searchCards(c.req.valid("query"));
  return c.json({ results });
});
