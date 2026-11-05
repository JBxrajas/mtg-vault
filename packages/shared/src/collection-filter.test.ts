import { describe, expect, it } from "vitest";
import { activeFilterCount, emptyFilters, filterCollection, manaValueBucket, normalizeText, setsIn, sortCollection } from "./collection-filter.js";
import type { CollectionItem } from "./index.js";

const stack = (over: Partial<CollectionItem> & { name: string }): CollectionItem => ({
  id: over.name,
  printingId: "p",
  oracleId: "o",
  typeLine: "Instant",
  cmc: 1,
  colorIdentity: ["R"],
  setCode: "lea",
  setName: "Limited Edition Alpha",
  collectorNumber: "1",
  rarity: "common",
  finish: "nonfoil",
  condition: "NM",
  language: "en",
  quantity: 1,
  purchasePrice: null,
  acquiredOn: null,
  notes: null,
  image: null,
  unitPrice: 1,
  pricesOn: null,
  ...over,
});

const items = [
  stack({ name: "Lightning Bolt" }),
  stack({ name: "Llanowar Elves", typeLine: "Creature — Elf Druid", cmc: 1, colorIdentity: ["G"], rarity: "common", setCode: "m19", setName: "Core Set 2019", unitPrice: 0.2, quantity: 4 }),
  stack({ name: "Lim-Dûl's Vault", typeLine: "Instant", cmc: 2, colorIdentity: ["U", "B"], rarity: "uncommon", setCode: "all", setName: "Alliances", finish: "foil", condition: "LP", unitPrice: 5, notes: "from the trade" }),
  stack({ name: "Sol Ring", typeLine: "Artifact", cmc: 1, colorIdentity: [], rarity: "uncommon", setCode: "cmm", setName: "Commander Masters", unitPrice: 2 }),
  stack({ name: "Black Lotus", typeLine: "Artifact", cmc: 0, colorIdentity: [], rarity: "rare", unitPrice: null }),
  stack({ name: "Kitchen Finks", typeLine: "Artifact Creature — Elemental", cmc: 3, colorIdentity: ["G", "W"], rarity: "uncommon", setCode: "m19", setName: "Core Set 2019", unitPrice: 1 }),
];
const names = (list: CollectionItem[]) => list.map((i) => i.name);

describe("filterCollection", () => {
  it("returns everything without filters", () => {
    expect(filterCollection(items, emptyFilters())).toHaveLength(6);
  });

  it("searches name, type, set, collector number and notes; every word must match; accents and case do not matter", () => {
    const find = (text: string) => names(filterCollection(items, { ...emptyFilters(), text }));
    expect(find("lightning")).toEqual(["Lightning Bolt"]);
    expect(find("lim-dul")).toEqual(["Lim-Dûl's Vault"]);
    expect(find("elf druid")).toEqual(["Llanowar Elves"]);
    expect(find("core set")).toEqual(["Llanowar Elves", "Kitchen Finks"]);
    expect(find("alliances vault")).toEqual(["Lim-Dûl's Vault"]);
    expect(find("TRADE")).toEqual(["Lim-Dûl's Vault"]);
    expect(find("vault bolt")).toEqual([]);
    expect(find("   ")).toHaveLength(6);
  });

  it("filters by color: a card needs all the colors picked, and colorless is on its own", () => {
    const by = (colors: ("W" | "U" | "B" | "R" | "G" | "C")[]) => names(filterCollection(items, { ...emptyFilters(), colors }));
    expect(by(["G"])).toEqual(["Llanowar Elves", "Kitchen Finks"]);
    expect(by(["U", "R"])).toEqual([]);
    expect(by(["U", "B"])).toEqual(["Lim-Dûl's Vault"]);
    expect(by(["W", "G"])).toEqual(["Kitchen Finks"]);
    expect(by(["C"])).toEqual(["Sol Ring", "Black Lotus"]);
    expect(by(["C", "W"])).toEqual(["Sol Ring", "Black Lotus"]);
  });

  it("filters by type with the card's main type, so an Artifact Creature is a Creature", () => {
    const by = (types: ("Creature" | "Artifact" | "Instant")[]) => names(filterCollection(items, { ...emptyFilters(), types }));
    expect(by(["Creature"])).toEqual(["Llanowar Elves", "Kitchen Finks"]);
    expect(by(["Artifact"])).toEqual(["Sol Ring", "Black Lotus"]);
    expect(by(["Instant", "Artifact"])).toEqual(["Lightning Bolt", "Lim-Dûl's Vault", "Sol Ring", "Black Lotus"]);
  });

  it("filters by rarity, set, finish and condition", () => {
    expect(names(filterCollection(items, { ...emptyFilters(), rarities: ["rare"] }))).toEqual(["Black Lotus"]);
    expect(names(filterCollection(items, { ...emptyFilters(), sets: ["m19"] }))).toEqual(["Llanowar Elves", "Kitchen Finks"]);
    expect(names(filterCollection(items, { ...emptyFilters(), finishes: ["foil"] }))).toEqual(["Lim-Dûl's Vault"]);
    expect(names(filterCollection(items, { ...emptyFilters(), conditions: ["LP"] }))).toEqual(["Lim-Dûl's Vault"]);
  });

  it("filters by mana value, with 7 standing for 7 or more", () => {
    expect([0, 0.5, 3, 6, 7, 9, 16, null, undefined].map(manaValueBucket)).toEqual([0, 0, 3, 6, 7, 7, 7, 0, 0]);
    expect(names(filterCollection(items, { ...emptyFilters(), manaValues: [2, 3, 4, 5, 6, 7] }))).toEqual(["Lim-Dûl's Vault", "Kitchen Finks"]);
    expect(names(filterCollection(items, { ...emptyFilters(), manaValues: [0] }))).toEqual(["Black Lotus"]);
    expect(names(filterCollection(items, { ...emptyFilters(), manaValues: [1, 2] }))).toHaveLength(4);
  });

  it("adds filters up: uncommon AND green", () => {
    expect(names(filterCollection(items, { ...emptyFilters(), rarities: ["uncommon"], colors: ["G"] }))).toEqual(["Kitchen Finks"]);
  });
});

describe("an older API answer", () => {
  it("does not break on stacks without the type line, mana value or colors", () => {
    const old = [{ ...items[0]!, typeLine: undefined, cmc: undefined, colorIdentity: undefined } as unknown as CollectionItem];
    expect(filterCollection(old, { ...emptyFilters(), text: "bolt", colors: ["C"], types: ["Other"], manaValues: [0] })).toHaveLength(1);
    expect(sortCollection(old, "mv")).toHaveLength(1);
  });
});

describe("activeFilterCount", () => {
  it("counts each filter that is set, a text of only spaces not included", () => {
    expect(activeFilterCount(emptyFilters())).toBe(0);
    expect(activeFilterCount({ ...emptyFilters(), text: "  " })).toBe(0);
    expect(activeFilterCount({ ...emptyFilters(), text: "bolt", colors: ["R", "G"], manaValues: [0] })).toBe(3);
  });
});

describe("sortCollection", () => {
  it("sorts by name, quantity, price, total value and mana value, in either direction, without changing the input", () => {
    const copy = [...items];
    expect(names(sortCollection(items, "name"))[0]).toBe("Black Lotus");
    expect(names(sortCollection(items, "quantity", true))[0]).toBe("Llanowar Elves"); // 4 copies
    expect(names(sortCollection(items, "price", true))[0]).toBe("Lim-Dûl's Vault");
    expect(names(sortCollection(items, "value", true))[0]).toBe("Lim-Dûl's Vault"); // 5 each beats 4 × 0.20
    expect(names(sortCollection(items, "mv", true))[0]).toBe("Kitchen Finks");
    expect(items).toEqual(copy);
  });

  it("counts a stack without a price as zero and breaks ties by name", () => {
    expect(names(sortCollection(items, "price"))[0]).toBe("Black Lotus");
    expect(names(sortCollection(items, "mv")).slice(0, 4)).toEqual(["Black Lotus", "Lightning Bolt", "Llanowar Elves", "Sol Ring"]);
  });
});

describe("setsIn / normalizeText", () => {
  it("lists each set once with its stack count, by name", () => {
    expect(setsIn(items).map((s) => `${s.code}:${s.count}`)).toEqual(["all:1", "cmm:1", "m19:2", "lea:2"]);
  });
  it("strips accents and case", () => {
    expect(normalizeText("  Lim-Dûl's   VAULT ")).toBe("lim-dul's vault");
  });
});
