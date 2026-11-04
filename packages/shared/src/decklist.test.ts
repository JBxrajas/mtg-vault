import { describe, expect, it } from "vitest";
import { deckImportRequestSchema, formatDeckList, parseDeckList } from "./decklist.js";

const names = (text: string) => parseDeckList(text).rows.map((r) => `${r.board}:${r.quantity} ${r.name}`);

describe("parseDeckList", () => {
  it("reads counts in the usual spellings", () => {
    expect(names("4 Lightning Bolt\n4x Goblin Guide\n20  Mountain")).toEqual([
      "main:4 Lightning Bolt",
      "main:4 Goblin Guide",
      "main:20 Mountain",
    ]);
  });

  it("takes a bare name as one copy", () => {
    expect(names("Sol Ring")).toEqual(["main:1 Sol Ring"]);
  });

  it("drops the set, collector number and foil marker from the name", () => {
    expect(names("4 Lightning Bolt (M10) 146\n1 Sol Ring [C21]\n2 Counterspell (MH2) 267 *F*\n1 Fire // Ice (MH2) 290")).toEqual([
      "main:4 Lightning Bolt",
      "main:1 Sol Ring",
      "main:2 Counterspell",
      "main:1 Fire // Ice",
    ]);
  });

  it("uses section headers, with or without a colon and in any case", () => {
    const text = "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n\nSIDEBOARD:\n2 Pyroblast\n\nMaybeboard\n1 Mana Crypt";
    expect(names(text)).toEqual([
      "commander:1 Atraxa, Praetors' Voice",
      "main:1 Sol Ring",
      "sideboard:2 Pyroblast",
      "maybeboard:1 Mana Crypt",
    ]);
  });

  it("starts the sideboard at the first blank line when there are no headers (MTGO style)", () => {
    expect(names("4 Lightning Bolt\n\n2 Pyroblast\n3 Smash to Smithereens")).toEqual([
      "main:4 Lightning Bolt",
      "sideboard:2 Pyroblast",
      "sideboard:3 Smash to Smithereens",
    ]);
  });

  it("does not treat blank lines as a sideboard when sections are named", () => {
    expect(names("Deck\n1 Sol Ring\n\n1 Arcane Signet")).toEqual(["main:1 Sol Ring", "main:1 Arcane Signet"]);
  });

  it("ignores leading blank lines, comments and Windows line breaks", () => {
    expect(names("\r\n// my list\r\n# notes\r\n4 Lightning Bolt\r\n")).toEqual(["main:4 Lightning Bolt"]);
  });

  it("reads SB: lines as sideboard", () => {
    expect(names("4 Lightning Bolt\nSB: 2 Pyroblast")).toEqual(["main:4 Lightning Bolt", "sideboard:2 Pyroblast"]);
  });

  it("reports impossible counts with their line and carries on", () => {
    const parsed = parseDeckList("4 Lightning Bolt\n0 Sol Ring\n1000 Island\n1 Mountain");
    expect(parsed.rows.map((r) => r.name)).toEqual(["Lightning Bolt", "Mountain"]);
    expect(parsed.problems.map((p) => [p.line, p.name])).toEqual([
      [2, "Sol Ring"],
      [3, "Island"],
    ]);
    expect(parsed.totalCards).toBe(5);
  });

  it("numbers lines from 1 over the whole text, blank ones included", () => {
    expect(parseDeckList("\n\n4 Lightning Bolt").rows[0]!.line).toBe(3);
  });

  it("an empty text has no rows", () => {
    expect(parseDeckList("  \n\n")).toEqual({ rows: [], problems: [], totalCards: 0 });
  });
});

describe("formatDeckList", () => {
  const cards = [
    { name: "Atraxa, Praetors' Voice", quantity: 1, board: "commander" as const },
    { name: "Sol Ring", quantity: 1, board: "main" as const },
    { name: "Forest", quantity: 20, board: "main" as const },
    { name: "Pyroblast", quantity: 2, board: "sideboard" as const },
  ];

  it("writes a header per board when there are several", () => {
    expect(formatDeckList(cards)).toBe(
      "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n20 Forest\n\nSideboard\n2 Pyroblast",
    );
  });

  it("leaves the header out when only the main board is used", () => {
    expect(formatDeckList([{ name: "Forest", quantity: 20, board: "main" }])).toBe("20 Forest");
    expect(formatDeckList([])).toBe("");
  });

  it("reads back to the same cards", () => {
    const back = parseDeckList(formatDeckList(cards)).rows.map(({ name, quantity, board }) => ({ name, quantity, board }));
    expect(back).toEqual([cards[0], cards[1], cards[2], cards[3]]);
  });
});

describe("deckImportRequestSchema", () => {
  const row = { line: 1, name: "Sol Ring", quantity: 1, board: "main" };
  it("accepts rows and refuses empty, oversized or invalid ones", () => {
    expect(deckImportRequestSchema.safeParse({ rows: [row] }).success).toBe(true);
    expect(deckImportRequestSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(deckImportRequestSchema.safeParse({ rows: Array(1001).fill(row) }).success).toBe(false);
    expect(deckImportRequestSchema.safeParse({ rows: [{ ...row, quantity: 1000 }] }).success).toBe(false);
    expect(deckImportRequestSchema.safeParse({ rows: [{ ...row, board: "graveyard" }] }).success).toBe(false);
  });
});
