import { describe, expect, it } from "vitest";
import {
  cardCategory,
  deckBoards,
  deckCardSetSchema,
  deckCount,
  deckInputSchema,
  deckTargetSize,
  deckUpdateSchema,
  groupByCategory,
} from "./decks.js";

describe("cardCategory", () => {
  it.each([
    ["Creature — Elf Druid", "Creature"],
    ["Legendary Creature — Human Wizard", "Creature"],
    ["Artifact Creature — Golem", "Creature"],
    ["Enchantment Creature — Nymph", "Creature"],
    ["Artifact — Equipment", "Artifact"],
    ["Legendary Artifact", "Artifact"],
    ["Enchantment — Aura", "Enchantment"],
    ["Instant", "Instant"],
    ["Tribal Instant — Elf", "Instant"],
    ["Kindred Sorcery — Goblin", "Sorcery"],
    ["Sorcery", "Sorcery"],
    ["Legendary Planeswalker — Jace", "Planeswalker"],
    ["Battle — Siege", "Battle"],
    ["Basic Land — Forest", "Land"],
    ["Artifact Land", "Land"],
    ["Land Creature — Forest Dryad", "Land"],
    ["Instant // Sorcery", "Instant"],
    ["Card // Card", "Other"],
    ["", "Other"],
  ])("%s -> %s", (typeLine, expected) => {
    expect(cardCategory(typeLine)).toBe(expected);
  });

  it("does not match a type that only appears as a subtype", () => {
    expect(cardCategory("Creature — Land Walker")).toBe("Creature");
    expect(cardCategory("Enchantment — Saga")).toBe("Enchantment");
  });
});

describe("groupByCategory", () => {
  const e = (typeLine: string, quantity: number, board: "main" | "sideboard" | "maybeboard" | "commander" = "main") => ({
    typeLine,
    quantity,
    board,
  });

  it("groups in display order, counts copies and omits empty groups", () => {
    const groups = groupByCategory([
      e("Basic Land — Forest", 10),
      e("Creature — Elf", 3),
      e("Creature — Bear", 2),
      e("Instant", 4),
    ]);
    expect(groups.map((g) => [g.category, g.count])).toEqual([
      ["Creature", 5],
      ["Instant", 4],
      ["Land", 10],
    ]);
  });

  it("puts the commander board in its own group first and skips side/maybe boards", () => {
    const groups = groupByCategory([
      e("Creature — Elf", 1),
      e("Legendary Creature — Elf", 1, "commander"),
      e("Instant", 2, "sideboard"),
      e("Sorcery", 1, "maybeboard"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Commander", "Creature"]);
  });
});

describe("deckInputSchema", () => {
  it("defaults to a private casual deck", () => {
    expect(deckInputSchema.parse({ name: " My deck " })).toEqual({
      name: "My deck",
      format: "casual",
      isPublic: false,
    });
  });

  it("rejects an unknown format and an empty name", () => {
    expect(deckInputSchema.safeParse({ name: "x", format: "pauperish" }).success).toBe(false);
    expect(deckInputSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("deck size and boards", () => {
  it("has a target size per format", () => {
    expect(deckTargetSize("commander")).toBe(100);
    expect(deckTargetSize("modern")).toBe(60);
    expect(deckTargetSize("brawl")).toBe(60);
    expect(deckTargetSize("casual")).toBeNull();
  });

  it("offers a commander board only to commander-style formats", () => {
    expect(deckBoards("commander")).toEqual(["main", "commander", "sideboard", "maybeboard"]);
    expect(deckBoards("oathbreaker")).toContain("commander");
    expect(deckBoards("modern")).toEqual(["main", "sideboard", "maybeboard"]);
  });

  it("counts the main and commander boards only", () => {
    expect(
      deckCount([
        { quantity: 60, board: "main" },
        { quantity: 1, board: "commander" },
        { quantity: 15, board: "sideboard" },
        { quantity: 3, board: "maybeboard" },
      ]),
    ).toBe(61);
    expect(deckCount([])).toBe(0);
  });
});

describe("deckUpdateSchema / deckCardSetSchema", () => {
  it("needs at least one valid field", () => {
    expect(deckUpdateSchema.safeParse({}).success).toBe(false);
    expect(deckUpdateSchema.safeParse({ description: null, isPublic: true }).success).toBe(true);
    expect(deckUpdateSchema.safeParse({ format: "nope" }).success).toBe(false);
  });

  it("allows 0 (remove) up to 999 copies and defaults the board to main", () => {
    const oracleId = "4457ed35-7c10-48c8-9776-456485fdf070";
    expect(deckCardSetSchema.parse({ oracleId, quantity: 0 })).toEqual({ oracleId, quantity: 0, board: "main" });
    expect(deckCardSetSchema.safeParse({ oracleId, quantity: 1000 }).success).toBe(false);
    expect(deckCardSetSchema.safeParse({ oracleId, quantity: -1 }).success).toBe(false);
  });

  it("takes a printing instead of, or with, the copies, and needs one of the two", () => {
    const oracleId = "4457ed35-7c10-48c8-9776-456485fdf070";
    const printingId = "5089ec1a-f881-4d55-af14-5d996171203b";
    expect(deckCardSetSchema.safeParse({ oracleId, printingId }).success).toBe(true);
    expect(deckCardSetSchema.safeParse({ oracleId, printingId: null }).success).toBe(true);
    expect(deckCardSetSchema.safeParse({ oracleId, quantity: 2, printingId }).success).toBe(true);
    expect(deckCardSetSchema.safeParse({ oracleId }).success).toBe(false);
    expect(deckCardSetSchema.safeParse({ oracleId, printingId: "nope" }).success).toBe(false);
  });
});
