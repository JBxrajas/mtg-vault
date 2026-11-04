import { beforeEach, describe, expect, it, vi } from "vitest";

const searchCards = vi.fn();
const listPrintings = vi.fn();
vi.mock("./cards.js", async (original) => ({
  ...(await original<typeof import("./cards.js")>()),
  searchCards,
  listPrintings,
}));

const deckFns = {
  listDecks: vi.fn(),
  createDeck: vi.fn(),
  getDeck: vi.fn(),
  updateDeck: vi.fn(),
  deleteDeck: vi.fn(),
  addDeckCard: vi.fn(),
  setDeckCard: vi.fn(),
};
vi.mock("./decks.js", () => deckFns);

const addItem = vi.fn();
const updateItem = vi.fn();
const removeItem = vi.fn();
const listItems = vi.fn();
const getCollectionId = vi.fn();
vi.mock("./collection.js", async (original) => ({
  ...(await original<typeof import("./collection.js")>()),
  addItem,
  updateItem,
  removeItem,
  listItems,
  getCollectionId,
}));

const getSession = vi.fn();
const signUpEmail = vi.fn();
const handler = vi.fn();
vi.mock("./auth.js", () => ({ getAuth: () => ({ handler, api: { getSession, signUpEmail } }) }));

const { app } = await import("./app.js");
const { HttpError } = await import("./collection.js");

beforeEach(() => {
  searchCards.mockReset();
  listPrintings.mockReset();
  getSession.mockReset();
  signUpEmail.mockReset();
  handler.mockReset();
  for (const f of [addItem, updateItem, removeItem, listItems, getCollectionId, ...Object.values(deckFns)]) f.mockReset();
  getCollectionId.mockResolvedValue("col-1");
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("CORS", () => {
  const preflight = (origin: string) =>
    app.request("/cards/search", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
    });

  it("allows the local web origin by default", async () => {
    const res = await preflight("http://localhost:5173");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("does not allow other origins", async () => {
    const res = await preflight("https://evil.example");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("reads allowed origins from CORS_ORIGINS", async () => {
    vi.stubEnv("CORS_ORIGINS", "https://a.example, https://b.example");
    const res = await preflight("https://b.example");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://b.example");
    vi.unstubAllEnvs();
  });
});

describe("GET /cards/search", () => {
  it("passes the validated query to searchCards and wraps the results", async () => {
    searchCards.mockResolvedValue([{ name: "Lightning Bolt" }]);
    const res = await app.request("/cards/search?q=bolt&limit=3&colors=r");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ name: "Lightning Bolt" }] });
    expect(searchCards).toHaveBeenCalledWith({ q: "bolt", limit: 3, colors: ["R"] });
  });

  it.each(["", "?q=a", "?q=bolt&colors=X", "?q=bolt&limit=99"])("returns 400 for %j", async (qs) => {
    const res = await app.request(`/cards/search${qs}`);
    expect(res.status).toBe(400);
    expect(searchCards).not.toHaveBeenCalled();
  });
});

describe("GET /cards/:oracleId/printings", () => {
  const id = "4457ed35-7c10-48c8-9776-456485fdf070";

  it("returns the printings", async () => {
    listPrintings.mockResolvedValue([{ id: "p1", setName: "Alpha" }]);
    const res = await app.request(`/cards/${id}/printings`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ printings: [{ id: "p1", setName: "Alpha" }] });
    expect(listPrintings).toHaveBeenCalledWith(id);
  });

  it("returns 404 when the card has no printings", async () => {
    listPrintings.mockResolvedValue([]);
    const res = await app.request(`/cards/${id}/printings`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for an id that is not a UUID", async () => {
    const res = await app.request("/cards/not-a-uuid/printings");
    expect(res.status).toBe(400);
    expect(listPrintings).not.toHaveBeenCalled();
  });
});

describe("POST /auth/register", () => {
  const post = (body: unknown) =>
    app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("signs up with a synthetic email and passes the Better Auth response through", async () => {
    signUpEmail.mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { "set-auth-token": "tok" } }));
    const res = await post({ username: "Alice_1", password: "correct horse" });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-auth-token")).toBe("tok");
    expect(signUpEmail).toHaveBeenCalledWith({
      body: { email: "alice_1@users.invalid", password: "correct horse", name: "Alice_1", username: "Alice_1" },
      asResponse: true,
    });
  });

  it("turns a Better Auth rule error (taken username) into a client error", async () => {
    signUpEmail.mockRejectedValue(Object.assign(new Error("Username is already taken."), { statusCode: 422 }));
    const res = await post({ username: "alice", password: "longenough" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Username is already taken." });
  });

  it("does not hide unexpected errors", async () => {
    signUpEmail.mockRejectedValue(new Error("db down"));
    const res = await post({ username: "alice", password: "longenough" });
    expect(res.status).toBe(500);
  });

  it.each([
    { username: "ab", password: "longenough" },
    { username: "bad name!", password: "longenough" },
    { username: "alice", password: "short" },
    { username: "alice" },
    {},
  ])("returns 400 for %j", async (body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});

describe("/api/auth/*", () => {
  it("closes email sign-up", async () => {
    const res = await app.request("/api/auth/sign-up/email", { method: "POST" });
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it("delegates other auth routes to Better Auth", async () => {
    handler.mockResolvedValue(new Response("ok"));
    const res = await app.request("/api/auth/sign-in/username", { method: "POST" });
    expect(await res.text()).toBe("ok");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("GET /me", () => {
  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    const res = await app.request("/me");
    expect(res.status).toBe(401);
  });

  it("returns the user with the username it was created with", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", username: "alice", displayUsername: "Alice" } });
    const res = await app.request("/me", { headers: { Authorization: "Bearer tok" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: "u1", username: "alice", displayUsername: "Alice" } });
  });

  it("falls back to the username when there is no display name", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", username: "alice" } });
    const res = await app.request("/me");
    expect((await res.json()) as unknown).toEqual({ user: { id: "u1", username: "alice", displayUsername: "alice" } });
  });
});

describe("CORS for auth", () => {
  it("exposes the token header and allows Authorization", async () => {
    const res = await app.request("/me", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    });
    expect(res.headers.get("access-control-allow-headers")).toContain("Authorization");
  });
});

describe("/collection/items", () => {
  const printingId = "4457ed35-7c10-48c8-9776-456485fdf070";
  const itemId = "2b93787d-47ea-4b8b-912d-ffc5d5440171";
  const asUser = () => getSession.mockResolvedValue({ user: { id: "u1" } });
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it.each([
    ["GET", "/collection/items"],
    ["POST", "/collection/items"],
    ["PATCH", `/collection/items/${itemId}`],
    ["DELETE", `/collection/items/${itemId}`],
  ])("%s %s requires a session", async (method, path) => {
    getSession.mockResolvedValue(null);
    const res = await app.request(path, { method });
    expect(res.status).toBe(401);
    expect(listItems).not.toHaveBeenCalled();
    expect(addItem).not.toHaveBeenCalled();
  });

  it("lists the stacks of the signed-in user's own collection", async () => {
    asUser();
    listItems.mockResolvedValue([{ id: itemId }]);
    const res = await send("GET", "/collection/items");
    expect(await res.json()).toEqual({ items: [{ id: itemId }] });
    expect(getCollectionId).toHaveBeenCalledWith("u1");
    expect(listItems).toHaveBeenCalledWith("col-1");
  });

  it("adds a stack with defaults and answers 201", async () => {
    asUser();
    addItem.mockResolvedValue({ id: itemId, quantity: 2 });
    const res = await send("POST", "/collection/items", { printingId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(addItem).toHaveBeenCalledWith("col-1", {
      printingId,
      quantity: 2,
      finish: "nonfoil",
      condition: "NM",
      language: "en",
    });
  });

  it.each([
    { printingId, quantity: 0 },
    { printingId, quantity: 10000 },
    { printingId: "nope", quantity: 1 },
    { printingId, quantity: 1, finish: "shiny" },
    { printingId, quantity: 1, condition: "XX" },
    { printingId, quantity: 1, acquiredOn: "yesterday" },
  ])("rejects an invalid stack %j", async (body) => {
    asUser();
    const res = await send("POST", "/collection/items", body);
    expect(res.status).toBe(400);
    expect(addItem).not.toHaveBeenCalled();
  });

  it("maps service errors to their status", async () => {
    asUser();
    addItem.mockRejectedValue(new HttpError(400, "This printing does not come in foil"));
    const res = await send("POST", "/collection/items", { printingId, quantity: 1, finish: "foil" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "This printing does not come in foil" });
  });

  it("updates a stack, and answers 404 for one that is not in this collection", async () => {
    asUser();
    updateItem.mockResolvedValueOnce({ id: itemId, quantity: 5 });
    const ok = await send("PATCH", `/collection/items/${itemId}`, { quantity: 5 });
    expect(ok.status).toBe(200);
    expect(updateItem).toHaveBeenCalledWith("col-1", itemId, { quantity: 5 });
    updateItem.mockResolvedValueOnce(null);
    expect((await send("PATCH", `/collection/items/${itemId}`, { quantity: 1 })).status).toBe(404);
  });

  it("answers 409 when the quantity is lower than what binders hold", async () => {
    asUser();
    updateItem.mockRejectedValue(new HttpError(409, "2 copies are placed in binders"));
    expect((await send("PATCH", `/collection/items/${itemId}`, { quantity: 1 })).status).toBe(409);
  });

  it.each([{}, { quantity: 0 }, { condition: "NM" }])("rejects an empty or invalid update %j", async (body) => {
    asUser();
    const res = await send("PATCH", `/collection/items/${itemId}`, body);
    expect(res.status).toBe(400);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a UUID", async () => {
    asUser();
    expect((await send("DELETE", "/collection/items/42")).status).toBe(400);
  });

  it("deletes with 204 and answers 404 when nothing was removed", async () => {
    asUser();
    removeItem.mockResolvedValueOnce(true);
    expect((await send("DELETE", `/collection/items/${itemId}`)).status).toBe(204);
    removeItem.mockResolvedValueOnce(false);
    expect((await send("DELETE", `/collection/items/${itemId}`)).status).toBe(404);
  });
});

describe("/decks", () => {
  const deckId = "2b93787d-47ea-4b8b-912d-ffc5d5440171";
  const oracleId = "4457ed35-7c10-48c8-9776-456485fdf070";
  const asUser = () => getSession.mockResolvedValue({ user: { id: "u1" } });
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it.each([
    ["GET", "/decks"],
    ["POST", "/decks"],
    ["GET", `/decks/${deckId}`],
    ["PATCH", `/decks/${deckId}`],
    ["DELETE", `/decks/${deckId}`],
    ["POST", `/decks/${deckId}/cards`],
    ["PUT", `/decks/${deckId}/cards`],
  ])("%s %s requires a session", async (method, path) => {
    getSession.mockResolvedValue(null);
    const res = await app.request(path, { method });
    expect(res.status).toBe(401);
    for (const f of Object.values(deckFns)) expect(f).not.toHaveBeenCalled();
  });

  it("lists the user's decks", async () => {
    asUser();
    deckFns.listDecks.mockResolvedValue([{ id: deckId }]);
    const res = await send("GET", "/decks");
    expect(await res.json()).toEqual({ decks: [{ id: deckId }] });
    expect(deckFns.listDecks).toHaveBeenCalledWith("u1");
  });

  it("creates a deck with defaults (private, casual) and answers 201", async () => {
    asUser();
    deckFns.createDeck.mockResolvedValue({ id: deckId });
    const res = await send("POST", "/decks", { name: " Elves " });
    expect(res.status).toBe(201);
    expect(deckFns.createDeck).toHaveBeenCalledWith("u1", { name: "Elves", format: "casual", isPublic: false });
  });

  it.each([{}, { name: "" }, { name: "x", format: "pauperish" }, { name: "x".repeat(101) }])(
    "rejects an invalid deck %j",
    async (body) => {
      asUser();
      expect((await send("POST", "/decks", body)).status).toBe(400);
      expect(deckFns.createDeck).not.toHaveBeenCalled();
    },
  );

  it("returns a deck, and 404 when it is not the user's", async () => {
    asUser();
    deckFns.getDeck.mockResolvedValueOnce({ deck: { id: deckId }, cards: [] });
    expect((await send("GET", `/decks/${deckId}`)).status).toBe(200);
    expect(deckFns.getDeck).toHaveBeenCalledWith("u1", deckId);
    deckFns.getDeck.mockResolvedValueOnce(null);
    expect((await send("GET", `/decks/${deckId}`)).status).toBe(404);
  });

  it("rejects ids that are not UUIDs", async () => {
    asUser();
    expect((await send("GET", "/decks/42")).status).toBe(400);
    expect((await send("DELETE", "/decks/42")).status).toBe(400);
  });

  it("updates a deck, rejects empty or invalid updates, and answers 404 for another user's deck", async () => {
    asUser();
    deckFns.updateDeck.mockResolvedValueOnce({ id: deckId, format: "commander" });
    expect((await send("PATCH", `/decks/${deckId}`, { format: "commander" })).status).toBe(200);
    expect(deckFns.updateDeck).toHaveBeenCalledWith("u1", deckId, { format: "commander" });
    expect((await send("PATCH", `/decks/${deckId}`, {})).status).toBe(400);
    expect((await send("PATCH", `/decks/${deckId}`, { format: "nope" })).status).toBe(400);
    deckFns.updateDeck.mockResolvedValueOnce(null);
    expect((await send("PATCH", `/decks/${deckId}`, { name: "x" })).status).toBe(404);
  });

  it("deletes with 204 and 404 when nothing was deleted", async () => {
    asUser();
    deckFns.deleteDeck.mockResolvedValueOnce(true);
    expect((await send("DELETE", `/decks/${deckId}`)).status).toBe(204);
    deckFns.deleteDeck.mockResolvedValueOnce(false);
    expect((await send("DELETE", `/decks/${deckId}`)).status).toBe(404);
  });

  it("adds cards to the main board by default and returns the updated deck", async () => {
    asUser();
    deckFns.addDeckCard.mockResolvedValue(undefined);
    deckFns.getDeck.mockResolvedValue({ deck: { id: deckId }, cards: [{ oracleId }] });
    const res = await send("POST", `/decks/${deckId}/cards`, { oracleId, quantity: 4 });
    expect(res.status).toBe(201);
    expect(deckFns.addDeckCard).toHaveBeenCalledWith("u1", deckId, { oracleId, quantity: 4, board: "main" });
    expect(await res.json()).toEqual({ deck: { id: deckId }, cards: [{ oracleId }] });
  });

  it.each([
    { oracleId, quantity: 0 },
    { oracleId: "nope", quantity: 1 },
    { oracleId, quantity: 1, board: "graveyard" },
  ])("rejects an invalid card to add %j", async (body) => {
    asUser();
    expect((await send("POST", `/decks/${deckId}/cards`, body)).status).toBe(400);
    expect(deckFns.addDeckCard).not.toHaveBeenCalled();
  });

  it("maps service errors on adding (unknown card, copy cap)", async () => {
    asUser();
    deckFns.addDeckCard.mockRejectedValue(new HttpError(404, "Card not found"));
    expect((await send("POST", `/decks/${deckId}/cards`, { oracleId, quantity: 1 })).status).toBe(404);
  });

  it("sets a quantity (0 allowed, to remove) and rejects negatives and huge values", async () => {
    asUser();
    deckFns.setDeckCard.mockResolvedValue(undefined);
    deckFns.getDeck.mockResolvedValue({ deck: { id: deckId }, cards: [] });
    expect((await send("PUT", `/decks/${deckId}/cards`, { oracleId, board: "sideboard", quantity: 0 })).status).toBe(200);
    expect(deckFns.setDeckCard).toHaveBeenCalledWith("u1", deckId, { oracleId, board: "sideboard", quantity: 0 });
    expect((await send("PUT", `/decks/${deckId}/cards`, { oracleId, quantity: -1 })).status).toBe(400);
    expect((await send("PUT", `/decks/${deckId}/cards`, { oracleId, quantity: 1000 })).status).toBe(400);
  });
});
