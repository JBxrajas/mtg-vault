import { describe, expect, it } from "vitest";
import {
  importRequestSchema,
  parseCollectionCsv,
  parseCondition,
  parseFinish,
  parseLanguage,
} from "./import.js";

const MOXFIELD_HEADER =
  '"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"';

describe("parseCondition", () => {
  it.each([
    ["Near Mint", "NM"],
    ["NM", "NM"],
    ["", "NM"],
    ["Lightly Played", "LP"],
    ["Slightly Played", "LP"],
    ["Moderately Played", "MP"],
    ["Played", "MP"],
    ["Heavily Played", "HP"],
    ["Damaged", "DMG"],
    ["dmg", "DMG"],
  ])("%j -> %s", (input, expected) => expect(parseCondition(input)).toBe(expected));

  it("returns null for something unknown", () => expect(parseCondition("pristine!!")).toBeNull());
});

describe("parseFinish", () => {
  it.each([
    ["", "nonfoil"],
    ["foil", "foil"],
    ["Foil", "foil"],
    ["etched", "etched"],
    ["normal", "nonfoil"],
    ["true", "foil"],
    ["false", "nonfoil"],
  ])("%j -> %s", (input, expected) => expect(parseFinish(input)).toBe(expected));

  it("returns null for something unknown", () => expect(parseFinish("sparkly")).toBeNull());
});

describe("parseLanguage", () => {
  it.each([
    ["English", "en"],
    ["Spanish", "es"],
    ["Japanese", "ja"],
    ["Simplified Chinese", "zhs"],
    ["Chinese Traditional", "zht"],
    ["de", "de"],
    ["", "en"],
  ])("%j -> %s", (input, expected) => expect(parseLanguage(input)).toBe(expected));

  it("returns null for something unknown", () => expect(parseLanguage("Klingon language")).toBeNull());
});

describe("parseCollectionCsv (Moxfield layout)", () => {
  it("reads a typical export", () => {
    const csv = [
      MOXFIELD_HEADER,
      '"4","0","Lightning Bolt","m10","Near Mint","English","","","2026-01-01 10:00:00.000000","146","False","False","1.50"',
      '"1","0","Black Lotus","lea","Heavily Played","English","","trade","2026-01-02","232","False","False",""',
      '"2","0","Sol Ring","cmd","Lightly Played","Spanish","foil","","2026-01-02","259","False","False","$3.00"',
    ].join("\n");
    const r = parseCollectionCsv(csv);

    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { line: 2, name: "Lightning Bolt", count: 4, setCode: "m10", collectorNumber: "146", finish: "nonfoil", condition: "NM", language: "en", purchasePrice: 1.5 },
      { line: 3, name: "Black Lotus", count: 1, setCode: "lea", collectorNumber: "232", finish: "nonfoil", condition: "HP", language: "en", notes: "trade" },
      { line: 4, name: "Sol Ring", count: 2, setCode: "cmd", collectorNumber: "259", finish: "foil", condition: "LP", language: "es", purchasePrice: 3 },
    ]);
    expect(r.totalCards).toBe(7);
    expect(r.columns).toMatchObject({ count: "Count", name: "Name", setCode: "Edition", foil: "Foil", price: "Purchase Price" });
    expect(r.ignoredColumns).toEqual(expect.arrayContaining(["Last Modified", "Alter"]));
  });

  it("matches headers regardless of case, spacing and order", () => {
    const r = parseCollectionCsv("name, QUANTITY ,Set Code,collector_number\nBolt,3,lea,161");
    expect(r.rows).toEqual([{ line: 2, name: "Bolt", count: 3, setCode: "lea", collectorNumber: "161", finish: "nonfoil", condition: "NM", language: "en" }]);
  });

  it("skips proxies and counts them", () => {
    const r = parseCollectionCsv(`${MOXFIELD_HEADER}\n"1","0","Black Lotus","lea","Near Mint","English","","","","232","False","True",""`);
    expect(r.rows).toEqual([]);
    expect(r.skipped).toBe(1);
    expect(r.problems).toEqual([]);
  });

  it("adds up identical lines and keeps different printings, finishes and conditions apart", () => {
    const r = parseCollectionCsv(
      [
        "Count,Name,Edition,Collector Number,Foil,Condition",
        "2,Bolt,m10,146,,Near Mint",
        "3,Bolt,m10,146,,Near Mint",
        "1,Bolt,m10,146,foil,Near Mint",
        "1,Bolt,m10,146,,Lightly Played",
        "1,Bolt,lea,161,,Near Mint",
      ].join("\n"),
    );
    expect(r.rows.map((x) => [x.setCode, x.finish, x.condition, x.count])).toEqual([
      ["m10", "nonfoil", "NM", 5],
      ["m10", "foil", "NM", 1],
      ["m10", "nonfoil", "LP", 1],
      ["lea", "nonfoil", "NM", 1],
    ]);
    expect(r.totalCards).toBe(8);
  });

  it("reports unreadable lines with their line number and keeps the good ones", () => {
    const r = parseCollectionCsv(
      ["Count,Name,Edition,Foil,Condition,Language", "x,Bolt,lea,,,", "0,Bolt,lea,,,", "1,,lea,,,", "1,Counterspell,ice,sparkly,,", "1,Mana Drain,mm3,,Pristine,", "1,Brainstorm,ice,,,Klingon language", "2,Opt,m21,,,"].join("\n"),
    );
    expect(r.rows.map((x) => x.name)).toEqual(["Opt"]);
    expect(r.problems.map((p) => [p.line, p.reason.split(" ")[0]])).toEqual([
      [2, "Count"],
      [3, "Count"],
      [4, "No"],
      [5, "Unknown"],
      [6, "Unknown"],
      [7, "Unknown"],
    ]);
  });

  it("rejects counts above 9999, also when repeated lines add up to it", () => {
    const r = parseCollectionCsv("Count,Name\n10000,Bolt\n9000,Island\n9000,Island");
    expect(r.rows).toEqual([]);
    expect(r.problems.map((p) => p.name)).toEqual(["Bolt", "Island"]);
  });

  it("reads Scryfall ids (ManaBox-style files) and prices with a currency sign or a decimal comma", () => {
    const id = "4457ed35-7c10-48c8-9776-456485fdf070";
    const r = parseCollectionCsv(`Name,Set code,Collector number,Foil,Quantity,Scryfall ID,Purchase price\nBolt,lea,161,foil,2,${id},"1,25"`);
    expect(r.rows[0]).toMatchObject({ scryfallId: id, purchasePrice: 1.25, finish: "foil", count: 2 });
  });

  it("drops an invalid Scryfall id as a problem and ignores a negative price", () => {
    const bad = parseCollectionCsv("Name,Quantity,Scryfall ID\nBolt,1,not-a-uuid");
    expect(bad.rows).toEqual([]);
    expect(bad.problems).toHaveLength(1);
    const neg = parseCollectionCsv("Name,Count,Purchase Price\nBolt,1,-3");
    expect(neg.rows[0]!.purchasePrice).toBeUndefined();
  });

  it("copes with a byte-order mark, CRLF and quoted names with commas", () => {
    const r = parseCollectionCsv('﻿"Count","Name"\r\n"1","Jace, the Mind Sculptor"\r\n');
    expect(r.rows[0]!.name).toBe("Jace, the Mind Sculptor");
  });

  it.each([
    ["", "empty"],
    ["Count,Edition\n1,lea", "No card name"],
    ["Name,Edition\nBolt,lea", "No count"],
  ])("throws a clear message for %j", (csv, fragment) => {
    expect(() => parseCollectionCsv(csv)).toThrow(new RegExp(fragment, "i"));
  });
});

describe("importRequestSchema", () => {
  const row = { line: 2, name: "Bolt", count: 1 };

  it("accepts rows and fills defaults", () => {
    const parsed = importRequestSchema.parse({ rows: [row] });
    expect(parsed.rows[0]).toMatchObject({ finish: "nonfoil", condition: "NM", language: "en" });
  });

  it("limits a request to 1000 rows and needs at least one", () => {
    expect(importRequestSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(importRequestSchema.safeParse({ rows: Array.from({ length: 1001 }, () => row) }).success).toBe(false);
    expect(importRequestSchema.safeParse({ rows: Array.from({ length: 1000 }, () => row) }).success).toBe(true);
  });

  it.each([{ count: 0 }, { count: 10000 }, { name: "" }, { finish: "shiny" }, { scryfallId: "x" }, { purchasePrice: -1 }])(
    "rejects a bad row %j",
    (patch) => {
      expect(importRequestSchema.safeParse({ rows: [{ ...row, ...patch }] }).success).toBe(false);
    },
  );
});
