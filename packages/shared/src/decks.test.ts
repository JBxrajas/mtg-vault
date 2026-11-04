import { describe, expect, it } from "vitest";
import { cardCategory, deckInputSchema, groupByCategory } from "./decks.js";

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
