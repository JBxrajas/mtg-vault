import { describe, expect, it } from "vitest";
import { cardSearchQuerySchema, collectionEntrySchema } from "./index.js";

describe("cardSearchQuerySchema", () => {
  it("applies the default limit and trims q", () => {
    expect(cardSearchQuerySchema.parse({ q: "  bolt " })).toEqual({ q: "bolt", limit: 20 });
  });

  it("coerces limit from a string", () => {
    expect(cardSearchQuerySchema.parse({ q: "bolt", limit: "5" }).limit).toBe(5);
  });

  it.each([{ q: "a" }, { q: " " }, { q: "x".repeat(101) }, {}])("rejects q=%j", (input) => {
    expect(cardSearchQuerySchema.safeParse(input).success).toBe(false);
  });

  it.each(["0", "51", "1.5"])("rejects limit=%s", (limit) => {
    expect(cardSearchQuerySchema.safeParse({ q: "bolt", limit }).success).toBe(false);
  });

  it("parses colors case-insensitively and ignores blanks", () => {
    expect(cardSearchQuerySchema.parse({ q: "bolt", colors: "r, g,," }).colors).toEqual(["R", "G"]);
  });

  it("rejects unknown colors", () => {
    expect(cardSearchQuerySchema.safeParse({ q: "bolt", colors: "R,X" }).success).toBe(false);
  });
});

describe("collectionEntrySchema", () => {
  const printingId = "4457ed35-7c10-48c8-9776-456485fdf070";

  it("fills defaults", () => {
    expect(collectionEntrySchema.parse({ printingId, quantity: 2 })).toMatchObject({
      finish: "nonfoil",
      condition: "NM",
      language: "en",
    });
  });

  it("rejects non-positive quantity and bad condition", () => {
    expect(collectionEntrySchema.safeParse({ printingId, quantity: 0 }).success).toBe(false);
    expect(collectionEntrySchema.safeParse({ printingId, quantity: 1, condition: "XX" }).success).toBe(false);
  });
});
