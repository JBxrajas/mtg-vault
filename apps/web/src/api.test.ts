import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPrintingsUrl, buildSearchUrl, fetchPrintings, searchCards } from "./api.js";

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

describe("printings", () => {
  const id = "4457ed35-7c10-48c8-9776-456485fdf070";

  it("builds the URL", () => {
    expect(buildPrintingsUrl(id, "https://api.example")).toBe(`https://api.example/cards/${id}/printings`);
  });

  it("returns the printings array", async () => {
    const printings = [{ id: "p1" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ printings }) }));
    expect(await fetchPrintings(id)).toEqual(printings);
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchPrintings(id)).rejects.toThrow("Could not load printings (404)");
  });
});
