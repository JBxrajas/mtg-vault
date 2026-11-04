import { describe, expect, it } from "vitest";
import { formatUsd, priceLine, printingLabel, releaseYear } from "./format.js";

const prices = { usd: 1.5, usdFoil: 3, usdEtched: null, eur: 1.2, eurFoil: null, tix: 0.02 };

describe("priceLine", () => {
  it("lists nonfoil, foil and euro prices", () => {
    expect(priceLine(prices)).toBe("$1.50 · foil $3.00 · €1.20");
  });

  it("skips missing prices", () => {
    expect(priceLine({ ...prices, usd: null, usdFoil: null })).toBe("€1.20");
    expect(priceLine({ ...prices, usdEtched: 9 })).toContain("etched $9.00");
  });

  it("is null without a snapshot or without any price", () => {
    expect(priceLine(null)).toBeNull();
    expect(priceLine({ usd: null, usdFoil: null, usdEtched: null, eur: null, eurFoil: null, tix: 0.5 })).toBeNull();
  });
});

describe("formatUsd", () => {
  it("formats and keeps null", () => {
    expect(formatUsd(1800)).toBe("$1,800.00");
    expect(formatUsd(null)).toBeNull();
  });
});

describe("printingLabel / releaseYear", () => {
  it("builds the label with an upper-case set code", () => {
    expect(printingLabel({ setName: "Limited Edition Alpha", setCode: "lea", collectorNumber: "161" })).toBe(
      "Limited Edition Alpha (LEA) #161",
    );
  });

  it("takes the year or an empty string", () => {
    expect(releaseYear("2026-11-02")).toBe("2026");
    expect(releaseYear(null)).toBe("");
  });
});
