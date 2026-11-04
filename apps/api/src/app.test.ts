import { beforeEach, describe, expect, it, vi } from "vitest";

const searchCards = vi.fn();
vi.mock("./cards.js", () => ({ searchCards }));

const { app } = await import("./app.js");

beforeEach(() => searchCards.mockReset());

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
