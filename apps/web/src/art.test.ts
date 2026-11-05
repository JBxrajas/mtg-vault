import { afterEach, describe, expect, it, vi } from "vitest";
import { artHref, artistSearchUrl, fetchArt, isPrintingId, parseScryfallArt } from "./art";

const ID = "bba5ea18-4e58-42a8-b613-2178706476a6";
const art = "https://cards.scryfall.io/art_crop/front/b/b/bba5ea18-4e58-42a8-b613-2178706476a6.jpg?1792156428";
const png = "https://cards.scryfall.io/png/front/b/b/bba5ea18-4e58-42a8-b613-2178706476a6.png?1792156428";

afterEach(() => vi.unstubAllGlobals());

describe("parseScryfallArt", () => {
  it("reads a single-faced card: artist, art, full card, printing and the Scryfall page", () => {
    const info = parseScryfallArt({
      name: "Lightning Bolt",
      set_name: "Secret Lair",
      set: "slc",
      collector_number: "83",
      released_at: "2025-01-02",
      scryfall_uri: "https://scryfall.com/card/slc/83/lightning-bolt",
      artist: "Christopher Moeller",
      flavor_text: "The sparkmage shrieked.",
      image_uris: { art_crop: art, png },
    });
    expect(info).toMatchObject({ name: "Lightning Bolt", setCode: "slc", collectorNumber: "83", scryfallUri: "https://scryfall.com/card/slc/83/lightning-bolt" });
    expect(info.faces).toEqual([{ name: "Lightning Bolt", artist: "Christopher Moeller", artCrop: art, png, flavorText: "The sparkmage shrieked." }]);
  });

  it("reads each face of a double-faced card, with its own artist", () => {
    const info = parseScryfallArt({
      name: "Delver of Secrets // Insectile Aberration",
      card_faces: [
        { name: "Delver of Secrets", artist: "Nils Hamm", image_uris: { art_crop: art, png } },
        { name: "Insectile Aberration", artist: "Nils Hamm", image_uris: { art_crop: art, png } },
      ],
    });
    expect(info.faces.map((f) => f.name)).toEqual(["Delver of Secrets", "Insectile Aberration"]);
  });

  it("drops addresses that are not Scryfall's, since they end up in the page", () => {
    const info = parseScryfallArt({
      name: "X",
      scryfall_uri: "https://evil.example/card",
      image_uris: { art_crop: "https://evil.example/a.jpg", png: "javascript:alert(1)" },
    });
    expect(info.scryfallUri).toBeNull();
    expect(info.faces[0]).toMatchObject({ artCrop: null, png: null, artist: null });
  });

  it("copes with an answer that is not a card", () => {
    expect(parseScryfallArt(null).faces).toHaveLength(1);
    expect(parseScryfallArt("nope").name).toBe("");
  });
});

describe("links", () => {
  it("builds the artist search with the name quoted and quotes inside it removed", () => {
    expect(artistSearchUrl('Chris "Rush" Rahn')).toBe("https://scryfall.com/search?q=a%3A%22Chris%20Rush%20Rahn%22&unique=art&as=grid&order=released");
  });
  it("opens the art page by hash route, and only accepts uuids", () => {
    expect(artHref(ID)).toBe(`#/art/${ID}`);
    expect(isPrintingId(ID)).toBe(true);
    expect(isPrintingId("../etc/passwd")).toBe(false);
    expect(isPrintingId(undefined)).toBe(false);
  });
});

describe("fetchArt", () => {
  it("asks Scryfall for the printing and parses the answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Lightning Bolt", artist: "A", image_uris: { art_crop: art } }) });
    vi.stubGlobal("fetch", fetchMock);
    const info = await fetchArt(ID);
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://api.scryfall.com/cards/${ID}`);
    expect(info.faces[0]!.artist).toBe("A");
  });

  it("refuses an id that is not a uuid without calling anything, and reports an error answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchArt("nope")).rejects.toThrow("Not a card id");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(fetchArt(ID)).rejects.toThrow("Scryfall answered 404");
  });
});
