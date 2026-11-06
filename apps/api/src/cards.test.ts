import { describe, expect, it } from "vitest";
import { likeEscape, toCardImage, toPrices } from "./cards.js";

describe("likeEscape", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(likeEscape("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(likeEscape("Lightning Bolt")).toBe("Lightning Bolt");
  });
});

describe("toCardImage", () => {
  const uris = {
    small: "https://cards.example/small.jpg",
    normal: "https://cards.example/normal.jpg",
    large: "https://cards.example/large.jpg",
    art_crop: "https://cards.example/art.jpg",
  };

  it("keeps the sizes the clients use and renames art_crop", () => {
    expect(toCardImage(uris)).toEqual({
      small: uris.small,
      normal: uris.normal,
      artCrop: uris.art_crop,
    });
  });

  it("carries the other face of a double-faced card, only when it has both sizes", () => {
    expect(toCardImage({ ...uris, back: { small: "bs", normal: "bn", art_crop: "x" } })?.back).toEqual({ small: "bs", normal: "bn" });
    expect(toCardImage({ ...uris, back: { small: "bs" } })).toEqual({ small: uris.small, normal: uris.normal, artCrop: uris.art_crop });
  });

  it.each([null, undefined, "x", 3, {}, { small: "a", normal: "b" }])("returns null for %j", (input) => {
    expect(toCardImage(input)).toBeNull();
  });
});

describe("toPrices", () => {
  it("converts numeric strings to numbers and keeps missing prices null", () => {
    expect(
      toPrices({ priced_on: "2026-11-04", usd: "1.50", usd_foil: "3.00", usd_etched: null, eur: "1.20", eur_foil: null, tix: "0.02" }),
    ).toEqual({ usd: 1.5, usdFoil: 3, usdEtched: null, eur: 1.2, eurFoil: null, tix: 0.02 });
  });

  it("returns null when there is no snapshot", () => {
    expect(toPrices({ priced_on: null, usd: null })).toBeNull();
  });
});
