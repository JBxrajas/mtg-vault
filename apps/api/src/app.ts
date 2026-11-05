import { zValidator } from "@hono/zod-validator";
import {
  cardLookupQuerySchema,
  cardSearchQuerySchema,
  collectionEntrySchema,
  deckCardSchema,
  deckImportRequestSchema,
  deckCardSetSchema,
  deckIdParamSchema,
  deckInputSchema,
  deckUpdateSchema,
  importRequestSchema,
  itemIdParamSchema,
  oracleIdParamSchema,
  registerSchema,
  syntheticEmail,
  updateCollectionItemSchema,
  type CurrentUser,
} from "@mtg-vault/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { getAuth } from "./auth.js";
import { listPrintings, lookupCards, searchCards } from "./cards.js";
import { addDeckCard, createDeck, deleteDeck, getDeck, importDeckRows, listDecks, setDeckCard, updateDeck } from "./decks.js";
import { HttpError, addItem, getCollectionId, listItems, removeItem, updateItem } from "./collection.js";
import { importRows } from "./import.js";
import { artIndexUrl } from "./art-index.js";
import { allowedOrigins } from "./origins.js";

type Env = { Variables: { userId: string } };
export const app = new Hono<Env>();

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins().includes(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization"],
    // The session token comes back in this header on sign-up and sign-in.
    exposeHeaders: ["set-auth-token"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/cards/search", zValidator("query", cardSearchQuerySchema), async (c) => {
  const results = await searchCards(c.req.valid("query"));
  return c.json({ results });
});

app.get("/cards/lookup", zValidator("query", cardLookupQuerySchema), async (c) => {
  return c.json({ cards: await lookupCards(c.req.valid("query").ids) });
});

app.get("/cards/:oracleId/printings", zValidator("param", oracleIdParamSchema), async (c) => {
  const printings = await listPrintings(c.req.valid("param").oracleId);
  if (printings.length === 0) return c.json({ error: "Card not found" }, 404);
  return c.json({ printings });
});

/**
 * The card scanner's art-fingerprint index (ADR 0014), a ~3.6 MB file built weekly by a GitHub
 * Action and published as a release asset. A browser cannot fetch release downloads itself (no
 * CORS), so it is streamed through here with long cache headers; the CDN keeps it for a day.
 */
app.get("/art-index", async (c) => {
  const upstream = await fetch(artIndexUrl(), { redirect: "follow" });
  if (upstream.status === 404) return c.json({ error: "The art index has not been published yet" }, 503);
  if (!upstream.ok || !upstream.body) return c.json({ error: "Could not fetch the art index" }, 502);
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
});

// Better Auth owns /api/auth/*. Email sign-up is closed: accounts are created through
// POST /auth/register so every user has a username.
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  if (c.req.path.endsWith("/sign-up/email")) return c.json({ error: "Use POST /auth/register" }, 404);
  return getAuth().handler(c.req.raw);
});

/** Creates an account from a username and a password. Returns the user and `set-auth-token`. */
app.post("/auth/register", zValidator("json", registerSchema), async (c) => {
  const { username, password } = c.req.valid("json");
  try {
    return await getAuth().api.signUpEmail({
      body: { email: syntheticEmail(username), password, name: username, username },
      asResponse: true,
    });
  } catch (e) {
    // Better Auth throws an APIError for rule violations such as a taken username.
    const err = e as { statusCode?: number; message?: string };
    if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500) {
      return c.json({ error: err.message ?? "Could not register" }, err.statusCode as 400 | 409 | 422);
    }
    throw e;
  }
});

/** The signed-in user, from the `Authorization: Bearer` token. */
app.get("/me", async (c) => {
  const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Not signed in" }, 401);
  const u = session.user as { id: string; username?: string | null; displayUsername?: string | null };
  const me: CurrentUser = {
    id: u.id,
    username: u.username ?? "",
    displayUsername: u.displayUsername ?? u.username ?? "",
  };
  return c.json({ user: me });
});

/** Requires a valid Bearer token and puts the user id on the context. */
const requireUser = createMiddleware<Env>(async (c, next) => {
  const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Not signed in" }, 401);
  c.set("userId", session.user.id);
  await next();
});

// The signed-in user's collection: stacks of identical cards (printing, finish, condition, language).
app.use("/collection/*", requireUser);

app.get("/collection/items", async (c) => {
  const collectionId = await getCollectionId(c.get("userId"));
  return c.json({ items: await listItems(collectionId) });
});

app.post("/collection/items", zValidator("json", collectionEntrySchema), async (c) => {
  const collectionId = await getCollectionId(c.get("userId"));
  return c.json({ item: await addItem(collectionId, c.req.valid("json")) }, 201);
});

/**
 * Imports rows read from a collection export. The count in the file sets the stack's quantity,
 * so importing the same file again changes nothing. Answers with what was created, updated,
 * adjusted and what could not be imported.
 */
app.post("/collection/import", zValidator("json", importRequestSchema), async (c) => {
  const collectionId = await getCollectionId(c.get("userId"));
  return c.json(await importRows(collectionId, c.req.valid("json").rows));
});

app.patch(
  "/collection/items/:id",
  zValidator("param", itemIdParamSchema),
  zValidator("json", updateCollectionItemSchema),
  async (c) => {
    const collectionId = await getCollectionId(c.get("userId"));
    const item = await updateItem(collectionId, c.req.valid("param").id, c.req.valid("json"));
    if (!item) return c.json({ error: "Item not found" }, 404);
    return c.json({ item });
  },
);

app.delete("/collection/items/:id", zValidator("param", itemIdParamSchema), async (c) => {
  const collectionId = await getCollectionId(c.get("userId"));
  if (!(await removeItem(collectionId, c.req.valid("param").id))) return c.json({ error: "Item not found" }, 404);
  return c.body(null, 204);
});

// Decks: many per user, owned by the signed-in user. Other users' decks answer 404.
app.use("/decks/*", requireUser);

app.get("/decks", async (c) => c.json({ decks: await listDecks(c.get("userId")) }));

app.post("/decks", zValidator("json", deckInputSchema), async (c) =>
  c.json({ deck: await createDeck(c.get("userId"), c.req.valid("json")) }, 201),
);

app.get("/decks/:id", zValidator("param", deckIdParamSchema), async (c) => {
  const detail = await getDeck(c.get("userId"), c.req.valid("param").id);
  if (!detail) return c.json({ error: "Deck not found" }, 404);
  return c.json(detail);
});

app.patch("/decks/:id", zValidator("param", deckIdParamSchema), zValidator("json", deckUpdateSchema), async (c) => {
  const deck = await updateDeck(c.get("userId"), c.req.valid("param").id, c.req.valid("json"));
  if (!deck) return c.json({ error: "Deck not found" }, 404);
  return c.json({ deck });
});

app.delete("/decks/:id", zValidator("param", deckIdParamSchema), async (c) => {
  if (!(await deleteDeck(c.get("userId"), c.req.valid("param").id))) return c.json({ error: "Deck not found" }, 404);
  return c.body(null, 204);
});

/** Adds copies of a card to a board of the deck. */
/** Imports a deck list (parsed by the client). The count sets the copies, so importing twice changes nothing. */
app.post("/decks/:id/import", zValidator("param", deckIdParamSchema), zValidator("json", deckImportRequestSchema), async (c) =>
  c.json(await importDeckRows(c.get("userId"), c.req.valid("param").id, c.req.valid("json").rows)),
);

app.post("/decks/:id/cards", zValidator("param", deckIdParamSchema), zValidator("json", deckCardSchema), async (c) => {
  await addDeckCard(c.get("userId"), c.req.valid("param").id, c.req.valid("json"));
  return c.json((await getDeck(c.get("userId"), c.req.valid("param").id))!, 201);
});

/** Sets the copies of a card on a board; 0 removes it. */
app.put("/decks/:id/cards", zValidator("param", deckIdParamSchema), zValidator("json", deckCardSetSchema), async (c) => {
  await setDeckCard(c.get("userId"), c.req.valid("param").id, c.req.valid("json"));
  return c.json((await getDeck(c.get("userId"), c.req.valid("param").id))!);
});
