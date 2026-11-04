import { beforeEach, describe, expect, it, vi } from "vitest";

const searchCards = vi.fn();
const listPrintings = vi.fn();
vi.mock("./cards.js", () => ({ searchCards, listPrintings }));

const getSession = vi.fn();
const signUpEmail = vi.fn();
const handler = vi.fn();
vi.mock("./auth.js", () => ({ getAuth: () => ({ handler, api: { getSession, signUpEmail } }) }));

const { app } = await import("./app.js");

beforeEach(() => {
  searchCards.mockReset();
  listPrintings.mockReset();
  getSession.mockReset();
  signUpEmail.mockReset();
  handler.mockReset();
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
