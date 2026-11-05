import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv.js";
import { collectionToCsv } from "./export.js";
import { parseCollectionCsv } from "./import.js";
import type { CollectionItem } from "./index.js";

const item = (over: Partial<CollectionItem> = {}): CollectionItem => ({
  id: "i1",
  printingId: "0b1f0e1a-5a46-4a07-8d1a-2f6e52c8b0aa",
  oracleId: "o1",
  name: "Lightning Bolt",
  typeLine: "Instant",
  cmc: 1,
  colorIdentity: ["R"],
  setCode: "lea",
  setName: "Limited Edition Alpha",
  collectorNumber: "161",
  rarity: "common",
  finish: "nonfoil",
  condition: "NM",
  language: "en",
  quantity: 2,
  purchasePrice: null,
  acquiredOn: null,
  notes: null,
  image: null,
  unitPrice: null,
  pricesOn: null,
  ...over,
});

describe("toCsv", () => {
  it("quotes only what needs it and reads back with parseCsv", () => {
    const rows = [
      ["a", "b,c", 'say "hi"', "line\nbreak", ""],
      ["1", "2", "3", "4", "5"],
    ];
    const text = toCsv(rows);
    expect(text.split("\r\n")[0]).toBe('a,"b,c","say ""hi""","line\nbreak",');
    expect(parseCsv(text)).toEqual([rows[0], rows[1]]);
  });
});

describe("collectionToCsv", () => {
  it("writes a header and one line per stack in the layout the import reads", () => {
    const csv = collectionToCsv([
      item(),
      item({ id: "i2", name: "Fire // Ice", finish: "foil", condition: "LP", language: "ja", purchasePrice: 1.5, quantity: 1 }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Count,Name,Edition,Condition,Language,Foil,Collector Number,Scryfall ID,Purchase Price");
    expect(lines[1]).toBe("2,Lightning Bolt,lea,Near Mint,English,,161,0b1f0e1a-5a46-4a07-8d1a-2f6e52c8b0aa,");
    expect(lines[2]).toContain("1,Fire // Ice,lea,Lightly Played,Japanese,foil,161,");
    expect(lines[2]!.endsWith(",1.5")).toBe(true);
  });

  it("imports back to the same stacks", () => {
    const items = [
      item({ name: 'Rowan, "Scholar", of Sparks', quantity: 3 }),
      item({ id: "i2", finish: "etched", condition: "DMG", language: "zhs", collectorNumber: "12a", purchasePrice: 0.25 }),
      item({ id: "i3", finish: "foil", condition: "HP", language: "ph", quantity: 9 }),
    ];
    const parsed = parseCollectionCsv(collectionToCsv(items));
    expect(parsed.problems).toEqual([]);
    expect(parsed.ignoredColumns).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    items.forEach((it, i) => {
      expect(parsed.rows[i]).toMatchObject({
        name: it.name,
        count: it.quantity,
        setCode: it.setCode,
        collectorNumber: it.collectorNumber,
        scryfallId: it.printingId,
        finish: it.finish,
        condition: it.condition,
        language: it.language,
        ...(it.purchasePrice == null ? {} : { purchasePrice: it.purchasePrice }),
      });
      if (it.purchasePrice == null) expect(parsed.rows[i]).not.toHaveProperty("purchasePrice");
    });
  });

  it("an empty collection exports just the header", () => {
    expect(collectionToCsv([])).toBe("Count,Name,Edition,Condition,Language,Foil,Collector Number,Scryfall ID,Purchase Price");
  });
});
