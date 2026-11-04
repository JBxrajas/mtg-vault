import { describe, expect, it } from "vitest";
import { toDeckCardEntry, toDeckSummary } from "./decks.js";

describe("toDeckSummary", () => {
  it("maps columns, converts the count and serialises the date", () => {
    expect(
      toDeckSummary({
        id: "d1",
        name: "Elves",
        format: "commander",
        description: null,
        is_public: true,
        card_count: "99",
        updated_at: new Date("2026-11-04T10:00:00Z"),
      }),
    ).toEqual({
      id: "d1",
      name: "Elves",
      format: "commander",
      description: null,
      isPublic: true,
      cardCount: 99,
      updatedAt: "2026-11-04T10:00:00.000Z",
    });
  });

  it("accepts a date that arrives as a string and an empty deck", () => {
    const d = toDeckSummary({ id: "d1", name: "x", format: "casual", is_public: false, card_count: null, updated_at: "2026-11-04 10:00:00+00" });
    expect(d.cardCount).toBe(0);
    expect(d.isPublic).toBe(false);
    expect(d.updatedAt).toBe("2026-11-04 10:00:00+00");
  });
});

describe("toDeckCardEntry", () => {
  const row = {
    oracle_id: "o1",
    board: "main",
    quantity: "4",
    printing_id: null,
    name: "Lightning Bolt",
    mana_cost: "{R}",
    type_line: "Instant",
    cmc: "1.0",
    image_uris: { small: "s", normal: "n", art_crop: "a" },
    owned: "2",
  };

  it("maps the card, its image and how many the user owns", () => {
    expect(toDeckCardEntry(row)).toEqual({
      oracleId: "o1",
      name: "Lightning Bolt",
      manaCost: "{R}",
      typeLine: "Instant",
      cmc: 1,
      board: "main",
      quantity: 4,
      printingId: null,
      image: { small: "s", normal: "n", artCrop: "a" },
      owned: 2,
    });
  });

  it("copes with no image, no mana cost and nothing owned", () => {
    const e = toDeckCardEntry({ ...row, image_uris: null, mana_cost: null, owned: null, type_line: null });
    expect(e.image).toBeNull();
    expect(e.manaCost).toBeNull();
    expect(e.owned).toBe(0);
    expect(e.typeLine).toBe("");
  });
});
