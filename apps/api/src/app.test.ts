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
