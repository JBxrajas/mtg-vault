import { describe, expect, it } from "vitest";
import {
  cardSearchQuerySchema,
  collectionEntrySchema,
  collectionTotals,
  loginSchema,
  registerSchema,
  syntheticEmail,
  unitPriceUsd,
  updateCollectionItemSchema,
} from "./index.js";

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

describe("registerSchema", () => {
  it("accepts a username and password and trims the username", () => {
    expect(registerSchema.parse({ username: " Alice.1 ", password: "12345678" })).toEqual({
      username: "Alice.1",
      password: "12345678",
    });
  });

  it.each(["ab", "a".repeat(31), "with space", "ñandú", "a-b"])("rejects username %j", (username) => {
    expect(registerSchema.safeParse({ username, password: "12345678" }).success).toBe(false);
  });

  it("rejects short and oversized passwords", () => {
    expect(registerSchema.safeParse({ username: "alice", password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ username: "alice", password: "x".repeat(129) }).success).toBe(false);
  });
});

describe("loginSchema / syntheticEmail", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ username: "alice", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ username: "", password: "x" }).success).toBe(false);
  });

  it("builds a lower-case address on the reserved .invalid domain", () => {
    expect(syntheticEmail(" Alice_1 ")).toBe("alice_1@users.invalid");
  });
});

describe("collection helpers", () => {
  const prices = { usd: 1, usdFoil: 3, usdEtched: null, eur: null, eurFoil: null, tix: null };

  it("unitPriceUsd picks the price of the finish", () => {
    expect(unitPriceUsd("nonfoil", prices)).toBe(1);
    expect(unitPriceUsd("foil", prices)).toBe(3);
    expect(unitPriceUsd("etched", prices)).toBeNull();
    expect(unitPriceUsd("foil", null)).toBeNull();
  });

  it("collectionTotals sums value, counts copies and flags unpriced ones", () => {
    expect(
      collectionTotals([
        { quantity: 2, unitPrice: 1.1 },
        { quantity: 3, unitPrice: 0.1 },
        { quantity: 4, unitPrice: null },
      ]),
    ).toEqual({ stacks: 3, copies: 9, unpriced: 4, valueUsd: 2.5 });
    expect(collectionTotals([])).toEqual({ stacks: 0, copies: 0, unpriced: 0, valueUsd: 0 });
  });

  it("updateCollectionItemSchema needs at least one valid field", () => {
    expect(updateCollectionItemSchema.safeParse({}).success).toBe(false);
    expect(updateCollectionItemSchema.safeParse({ quantity: 2 }).success).toBe(true);
    expect(updateCollectionItemSchema.safeParse({ notes: null, purchasePrice: null }).success).toBe(true);
    expect(updateCollectionItemSchema.safeParse({ quantity: 0 }).success).toBe(false);
    // What the stack is can change too.
    expect(updateCollectionItemSchema.safeParse({ printingId: "4457ed35-7c10-48c8-9776-456485fdf070", finish: "foil", condition: "LP", language: "es" }).success).toBe(true);
    expect(updateCollectionItemSchema.safeParse({ printingId: "nope" }).success).toBe(false);
    expect(updateCollectionItemSchema.safeParse({ finish: "shiny" }).success).toBe(false);
  });

  it("collectionEntrySchema validates the optional purchase data", () => {
    const printingId = "4457ed35-7c10-48c8-9776-456485fdf070";
    expect(collectionEntrySchema.safeParse({ printingId, quantity: 1, acquiredOn: "2026-11-04", purchasePrice: 2 }).success).toBe(true);
    expect(collectionEntrySchema.safeParse({ printingId, quantity: 1, acquiredOn: "04/11/2026" }).success).toBe(false);
    expect(collectionEntrySchema.safeParse({ printingId, quantity: 1, purchasePrice: -1 }).success).toBe(false);
  });
});
