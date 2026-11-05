import type { ArtIndexEntry, PrintingSummary } from "@mtg-vault/shared";
import { describe, expect, it } from "vitest";
import { candidateCards, candidatesFromMatches, pickPrinting, scanPrice } from "./identify";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const hashWith = (ones: number) => {
  const h = new Uint8Array(32);
  for (let i = 0; i < ones; i++) h[i >> 3]! |= 1 << (i & 7);
  return h;
};
const entry = (n: number, ones: number, oracle = n): ArtIndexEntry => ({ illustrationId: id(n), oracleId: id(oracle), hash: hashWith(ones) });

describe("candidateCards", () => {
  it("lists each card once, nearest first, with how sure the match is", () => {
    const index = [entry(1, 60), entry(2, 61, 1), entry(3, 180), entry(4, 240)];
    const { cards, confidence } = candidateCards(index, hashWith(60), 3);
    expect(cards.map((c) => c.oracleId)).toEqual([id(1), id(3), id(4)]);
    expect(cards.map((c) => c.illustrationId)).toEqual([id(1), id(3), id(4)]);
    expect(confidence).toBe("sure");
  });

  it("says none for a flat picture, however close it is to a card", () => {
    expect(candidateCards([entry(1, 5)], hashWith(0))).toEqual({ cards: [], confidence: "none" });
  });

  it("says none when nothing is close", () => {
    expect(candidateCards([entry(1, 200)], hashWith(60)).confidence).toBe("none");
    expect(candidateCards([], hashWith(60))).toEqual({ cards: [], confidence: "none" });
  });
});

describe("candidatesFromMatches", () => {
  it("keeps the order, skips repeats of a card and stops at the limit", () => {
    const m = (n: number, oracle: number, distance: number) => ({ entry: entry(n, 0, oracle), distance });
    const { cards } = candidatesFromMatches([m(1, 1, 10), m(2, 1, 12), m(3, 2, 60), m(4, 3, 70), m(5, 4, 80)], 3);
    expect(cards.map((c) => c.oracleId)).toEqual([id(1), id(2), id(3)]);
  });
  it("has no cards for no matches", () => {
    expect(candidatesFromMatches([])).toEqual({ cards: [], confidence: "none" });
  });
});

const printing = (over: Partial<PrintingSummary>): PrintingSummary => ({
  id: "p", setCode: "xxx", setName: "X", collectorNumber: "1", lang: "en", rarity: "common", releasedAt: "2020-01-01",
  finishes: ["nonfoil"], image: null, prices: null, pricesOn: null, ...over,
});

describe("pickPrinting", () => {
  const list = [
    printing({ id: "en-old", lang: "en", releasedAt: "2010-01-01" }),
    printing({ id: "en-new", lang: "en", releasedAt: "2024-01-01" }),
    printing({ id: "es", lang: "es", releasedAt: "2018-01-01" }),
  ];
  it("takes the newest printing in the chosen language", () => {
    expect(pickPrinting(list, "es")?.id).toBe("es");
    expect(pickPrinting(list, "en")?.id).toBe("en-new");
  });
  it("falls back to English, then to anything", () => {
    expect(pickPrinting(list, "ja")?.id).toBe("en-new");
    expect(pickPrinting([printing({ id: "ru", lang: "ru" })], "ja")?.id).toBe("ru");
    expect(pickPrinting([], "en")).toBeUndefined();
  });
  it("only considers the printings that have the art that was seen, when it is known", () => {
    const art = id(7);
    const withArt = [
      printing({ id: "showcase-en", lang: "en", releasedAt: "2020-01-01", illustrationIds: [art] }),
      printing({ id: "showcase-ja", lang: "ja", releasedAt: "2021-01-01", illustrationIds: [art] }),
      printing({ id: "plain-new", lang: "en", releasedAt: "2024-01-01", illustrationIds: [id(8)] }),
    ];
    expect(pickPrinting(withArt, "en", art)?.id).toBe("showcase-en");
    expect(pickPrinting(withArt, "ja", art)?.id).toBe("showcase-ja");
    // The language wanted has no printing with this art: the art wins.
    expect(pickPrinting(withArt, "es", art)?.id).toBe("showcase-en");
    // Unknown art, or printings imported before the art was recorded: as before.
    expect(pickPrinting(withArt, "en")?.id).toBe("plain-new");
    expect(pickPrinting(withArt, "en", id(9))?.id).toBe("plain-new");
    expect(pickPrinting(list, "en", art)?.id).toBe("en-new");
  });
  it("copes with a missing release date", () => {
    expect(pickPrinting([printing({ id: "a", releasedAt: null }), printing({ id: "b" })], "en")?.id).toBe("b");
  });
});

describe("scanPrice", () => {
  const prices = { usd: 1.5, usdFoil: 4, usdEtched: 9, eur: null, eurFoil: null, tix: null };
  it("uses the price of the printing's first finish", () => {
    expect(scanPrice(printing({ prices, finishes: ["nonfoil", "foil"] }))).toBe(1.5);
    expect(scanPrice(printing({ prices, finishes: ["foil"] }))).toBe(4);
    expect(scanPrice(printing({ prices, finishes: ["etched"] }))).toBe(9);
  });
  it("falls back to another price, and to null when there is none", () => {
    expect(scanPrice(printing({ prices: { ...prices, usd: null }, finishes: ["nonfoil"] }))).toBe(4);
    expect(scanPrice(printing({ prices: null }))).toBeNull();
    expect(scanPrice(printing({ prices: { ...prices, usd: null, usdFoil: null, usdEtched: null } }))).toBeNull();
  });
});
