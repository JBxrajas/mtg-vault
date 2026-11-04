import { describe, expect, it } from "vitest";
import { hasAnyPrice, parsePrices, priceKey } from "./prices.js";

describe("parsePrices", () => {
  it("normalizes to two decimals and maps names", () => {
    expect(parsePrices({ usd: "0.5", usd_foil: "12", eur: "1.234", tix: "0.02" })).toEqual({
      usd: "0.50",
      usdFoil: "12.00",
      usdEtched: null,
      eur: "1.23",
      eurFoil: null,
      tix: "0.02",
    });
  });

  it("treats missing, null, empty and non-numeric values as null", () => {
    const row = parsePrices({ usd: null, usd_foil: "", eur: "abc" });
    expect(Object.values(row).every((v) => v === null)).toBe(true);
    expect(parsePrices(undefined).usd).toBeNull();
  });
});

describe("hasAnyPrice / priceKey", () => {
  it("detects an all-null row", () => {
    expect(hasAnyPrice(parsePrices({}))).toBe(false);
    expect(hasAnyPrice(parsePrices({ tix: "0.01" }))).toBe(true);
  });

  it("is equal for the same prices however they were written", () => {
    expect(priceKey(parsePrices({ usd: "1.5" }))).toBe(priceKey(parsePrices({ usd: "1.50" })));
  });

  it("differs when any price differs, and null differs from a value", () => {
    const a = priceKey(parsePrices({ usd: "1.50" }));
    expect(a).not.toBe(priceKey(parsePrices({ usd: "1.51" })));
    expect(a).not.toBe(priceKey(parsePrices({ usd_foil: "1.50" })));
    expect(a).not.toBe(priceKey(parsePrices({})));
  });
});
