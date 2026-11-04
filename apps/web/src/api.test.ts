import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSearchUrl, searchCards } from "./api.js";

afterEach(() => vi.unstubAllGlobals());

describe("buildSearchUrl", () => {
  it("encodes q and omits empty options", () => {
    expect(buildSearchUrl({ q: "lightning bolt" }, "https://api.example")).toBe(
      "https://api.example/cards/search?q=lightning+bolt",
    );
  });

  it("adds type, colors and limit", () => {
    const url = new URL(
      buildSearchUrl({ q: "bolt", type: "instant", colors: ["R", "G"], limit: 5 }, "https://api.example"),
    );
    expect(url.searchParams.get("type")).toBe("instant");
    expect(url.searchParams.get("colors")).toBe("R,G");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("skips an empty colors list", () => {
    const url = new URL(buildSearchUrl({ q: "bolt", colors: [] }, "https://api.example"));
    expect(url.searchParams.has("colors")).toBe(false);
  });
});

describe("searchCards", () => {
  it("returns the results array", async () => {
    const results = [{ oracleId: "1", name: "Lightning Bolt", manaCost: "{R}", typeLine: "Instant", similarity: 1, image: null }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results }) }));
    expect(await searchCards({ q: "bolt" })).toEqual(results);
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(searchCards({ q: "bolt" })).rejects.toThrow("Search failed (400)");
  });
});
