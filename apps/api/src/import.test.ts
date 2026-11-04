import type { ImportRow } from "@mtg-vault/shared";
import { describe, expect, it } from "vitest";
import { planImport, type Resolved } from "./import.js";

const row = (over: Partial<ImportRow> = {}): ImportRow => ({
  line: 2,
  name: "Lightning Bolt",
  count: 1,
  finish: "nonfoil",
  condition: "NM",
  language: "en",
  ...over,
});
const res = (over: Partial<Resolved> = {}): Resolved => ({
  printingId: "p1",
  finishes: ["nonfoil", "foil"],
  match: "set+number",
  setCode: "m10",
  collectorNumber: "146",
  ...over,
});
const resolved = (...entries: [number, Resolved][]) => new Map(entries);

describe("planImport", () => {
  it("turns a resolved row into a stack", () => {
    const { stacks, problems, adjusted } = planImport(
      [row({ count: 4, setCode: "m10", collectorNumber: "146", purchasePrice: 1.5, notes: "trade" })],
      resolved([2, res()]),
    );
    expect(problems).toEqual([]);
    expect(adjusted).toEqual([]);
    expect(stacks).toEqual([
      { line: 2, name: "Lightning Bolt", printingId: "p1", finish: "nonfoil", condition: "NM", language: "en", quantity: 4, purchasePrice: 1.5, notes: "trade" },
    ]);
  });

  it("reports a card that was not found, with the set and number it asked for", () => {
    const { stacks, problems } = planImport(
      [row({ line: 3, name: "Black Lotus", setCode: "xyz", collectorNumber: "9" }), row({ line: 4, name: "Nope" })],
      resolved(),
    );
    expect(stacks).toEqual([]);
    expect(problems).toEqual([
      { line: 3, name: "Black Lotus", reason: "No card found in XYZ #9" },
      { line: 4, name: "Nope", reason: "No card found" },
    ]);
  });

  it("changes a finish the printing does not have and says so", () => {
    const { stacks, adjusted } = planImport([row({ finish: "foil" })], resolved([2, res({ finishes: ["nonfoil"] })]));
    expect(stacks[0]!.finish).toBe("nonfoil");
    expect(adjusted).toEqual([{ line: 2, name: "Lightning Bolt", reason: "This printing does not come in foil; imported as nonfoil" }]);
  });

  it("falls back to the first finish the printing has, or nonfoil when it lists none", () => {
    expect(planImport([row({ finish: "etched" })], resolved([2, res({ finishes: ["foil"] })])).stacks[0]!.finish).toBe("foil");
    expect(planImport([row({ finish: "foil" })], resolved([2, res({ finishes: [] })])).stacks[0]!.finish).toBe("nonfoil");
  });

  it("says when the number in the set was not found and another printing of the card in the set was used", () => {
    const { adjusted } = planImport(
      [row({ setCode: "m10", collectorNumber: "999" })],
      resolved([2, res({ match: "set+name", collectorNumber: "146" })]),
    );
    expect(adjusted).toEqual([{ line: 2, name: "Lightning Bolt", reason: "No M10 #999; imported #146 of that set" }]);
  });

  it("says when the set had no such card and only the name matched", () => {
    const { adjusted } = planImport(
      [row({ setCode: "zzz", collectorNumber: "1" })],
      resolved([2, res({ match: "name", setCode: "lea", collectorNumber: "161" })]),
    );
    expect(adjusted[0]!.reason).toBe("Set ZZZ has no such card; imported the printing LEA #161");
  });

  it("stays quiet when no set was given and the card was found by name", () => {
    const { adjusted, problems } = planImport([row()], resolved([2, res({ match: "name" })]));
    expect(adjusted).toEqual([]);
    expect(problems).toEqual([]);
  });

  it("adds rows that land on the same stack, even from different lines, and keeps the first price and note", () => {
    const { stacks } = planImport(
      [row({ line: 2, count: 2 }), row({ line: 3, count: 3, purchasePrice: 2, notes: "a" }), row({ line: 4, count: 1, purchasePrice: 9, notes: "b" })],
      resolved([2, res()], [3, res()], [4, res()]),
    );
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({ quantity: 6, purchasePrice: 2, notes: "a", line: 2 });
  });

  it("keeps different finishes, conditions and languages apart", () => {
    const { stacks } = planImport(
      [row({ line: 2 }), row({ line: 3, finish: "foil" }), row({ line: 4, condition: "LP" }), row({ line: 5, language: "es" })],
      resolved([2, res()], [3, res()], [4, res()], [5, res()]),
    );
    expect(stacks).toHaveLength(4);
  });

  it("refuses a stack that would hold more than 9999 copies", () => {
    const { stacks, problems } = planImport(
      [row({ line: 2, count: 9000 }), row({ line: 3, count: 9000 })],
      resolved([2, res()], [3, res()]),
    );
    expect(stacks).toEqual([]);
    expect(problems[0]!.reason).toMatch(/more than 9999/);
  });
});
