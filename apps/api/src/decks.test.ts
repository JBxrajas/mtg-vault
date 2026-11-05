import { describe, expect, it } from "vitest";
import { planDeckImport, toDeckCardEntry, toDeckSummary } from "./decks.js";

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
      commander: null,
    });
  });

  it("carries the commander with its colors and the sizes of its picture", () => {
    const d = toDeckSummary({
      id: "d1",
      name: "Elves",
      format: "commander",
      is_public: false,
      card_count: 100,
      updated_at: "2026-11-04T10:00:00Z",
      commander_name: "Iroh, Grand Lotus",
      commander_colors: ["U", "R", "G"],
      commander_image: { small: "s.jpg", normal: "n.jpg", art_crop: "a.jpg" },
    });
    expect(d.commander).toEqual({ name: "Iroh, Grand Lotus", colorIdentity: ["U", "R", "G"], image: { small: "s.jpg", normal: "n.jpg", artCrop: "a.jpg" } });
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
    oracle_text: "Lightning Bolt deals 3 damage to any target.",
    color_identity: ["R"],
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
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      colorIdentity: ["R"],
      board: "main",
      quantity: 4,
      printingId: null,
      image: { small: "s", normal: "n", artCrop: "a" },
      owned: 2,
    });
  });

  it("copes with no image, no mana cost and nothing owned", () => {
    const e = toDeckCardEntry({ ...row, image_uris: null, mana_cost: null, owned: null, type_line: null, oracle_text: null, color_identity: null });
    expect(e.image).toBeNull();
    expect(e.manaCost).toBeNull();
    expect(e.owned).toBe(0);
    expect(e.typeLine).toBe("");
    expect(e.oracleText).toBeNull();
    expect(e.colorIdentity).toEqual([]);
  });
});

describe("planDeckImport", () => {
  const row = (line: number, name: string, quantity: number, board: "main" | "sideboard" | "maybeboard" | "commander" = "main") => ({
    line,
    name,
    quantity,
    board,
  });

  it("keeps resolved rows and reports the ones with no card", () => {
    const plan = planDeckImport([row(1, "Lightning Bolt", 4), row(2, "Lightnin Bolt", 1)], new Map([[1, "o-bolt"]]), "modern");
    expect(plan.entries).toEqual([{ oracleId: "o-bolt", board: "main", quantity: 4 }]);
    expect(plan.problems).toEqual([{ line: 2, name: "Lightnin Bolt", reason: "No card found" }]);
  });

  it("adds up lines for the same card on the same board but keeps boards apart", () => {
    const resolved = new Map([
      [1, "o-bolt"],
      [2, "o-bolt"],
      [3, "o-bolt"],
    ]);
    const plan = planDeckImport([row(1, "Bolt", 2), row(2, "Bolt", 1), row(3, "Bolt", 3, "sideboard")], resolved, "modern");
    expect(plan.entries).toEqual([
      { oracleId: "o-bolt", board: "main", quantity: 3 },
      { oracleId: "o-bolt", board: "sideboard", quantity: 3 },
    ]);
  });

  it("refuses the commander board for formats without one, and allows it for Commander, Brawl and Oathbreaker", () => {
    const resolved = new Map([[1, "o-atraxa"]]);
    const rows = [row(1, "Atraxa", 1, "commander")];
    expect(planDeckImport(rows, resolved, "modern").problems[0]?.reason).toMatch(/Commander, Brawl and Oathbreaker/);
    expect(planDeckImport(rows, resolved, "modern").entries).toEqual([]);
    for (const format of ["commander", "brawl", "oathbreaker"] as const) {
      expect(planDeckImport(rows, resolved, format).entries).toEqual([{ oracleId: "o-atraxa", board: "commander", quantity: 1 }]);
    }
  });

  it("reports lines that add up to more than 999 copies instead of writing them", () => {
    const resolved = new Map([
      [1, "o-island"],
      [2, "o-island"],
    ]);
    const plan = planDeckImport([row(1, "Island", 600), row(2, "Island", 600)], resolved, "casual");
    expect(plan.entries).toEqual([]);
    expect(plan.problems).toEqual([{ line: 1, name: "Island", reason: "Lines for the same card add up to more than 999 copies" }]);
  });
});
