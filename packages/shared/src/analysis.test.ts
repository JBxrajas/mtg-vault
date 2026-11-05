import { describe, expect, it } from "vitest";
import { analyzeCommanderDeck, cardProblems, cardRoles, type AnalyzedCard } from "./analysis.js";
import { LAND_FORMULA, recommendedLands } from "./knowledge.js";

describe("cardRoles", () => {
  const roles = (typeLine: string, oracleText: string | null) => cardRoles({ typeLine, oracleText });

  it("finds mana rocks and mana creatures", () => {
    expect(roles("Artifact", "{T}: Add {C}{C}.")).toEqual(["ramp"]);
    expect(roles("Creature — Elf Druid", "{T}: Add {G}.")).toEqual(["ramp"]);
    expect(roles("Artifact", "{1}, {T}, Sacrifice this artifact: Add {C}{C}{C}.")).toEqual(["ramp"]);
    expect(roles("Instant", "Add {R}{R}{R}.")).toEqual([]); // a ritual, not ramp
  });

  it("finds spells that fetch lands onto the battlefield, and Treasure makers", () => {
    expect(roles("Sorcery", "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.")).toEqual(["ramp"]);
    expect(roles("Sorcery", "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.")).toEqual(["ramp"]);
    expect(roles("Enchantment", "Whenever you cast a spell, create a Treasure token.")).toEqual(["ramp"]);
    expect(roles("Enchantment", "You may play an additional land on each of your turns.")).toEqual(["ramp"]);
  });

  it("does not count a tutor for a land that goes to the hand as ramp", () => {
    expect(roles("Sorcery", "Search your library for a basic land card, reveal it, put it into your hand, then shuffle.")).toEqual([]);
  });

  it("finds card draw but not cards the opponent draws", () => {
    expect(roles("Sorcery", "Draw three cards.")).toEqual(["draw"]);
    expect(roles("Instant", "Draw a card, then discard a card.")).toEqual(["draw"]);
    expect(roles("Creature — Human", "Whenever this creature attacks, you draw two cards.")).toEqual(["draw"]);
    expect(roles("Sorcery", "Each opponent draws a card.")).toEqual([]);
    expect(roles("Sorcery", "Exile the top two cards of your library. Until the end of your next turn, you may play those cards.")).toEqual(["draw"]);
  });

  it("finds spot removal, and skips graveyard hate, blinking your own creature and land destruction", () => {
    expect(roles("Instant", "Destroy target creature.")).toEqual(["removal"]);
    expect(roles("Instant", "Exile target nonland permanent.")).toEqual(["removal"]);
    expect(roles("Instant", "This spell deals 3 damage to any target.")).toEqual(["removal"]);
    expect(roles("Instant", "Target creature gets -3/-3 until end of turn.")).toEqual(["removal"]);
    expect(roles("Instant", "Exile target card from a graveyard.")).toEqual([]);
    expect(roles("Instant", "Exile target creature you control, then return it to the battlefield.")).toEqual([]);
    expect(roles("Sorcery", "Destroy target land.")).toEqual([]);
    expect(roles("Instant", "Counter target spell.")).toEqual([]);
  });

  it("finds board wipes", () => {
    expect(roles("Sorcery", "Destroy all creatures.")).toEqual(["wipe"]);
    expect(roles("Sorcery", "Exile all nonland permanents.")).toEqual(["wipe"]);
    expect(roles("Sorcery", "Destroy all non-Wall creatures.")).toEqual(["wipe"]);
    expect(roles("Sorcery", "This spell deals 2 damage to each creature.")).toEqual(["wipe"]);
    expect(roles("Instant", "All creatures get -3/-3 until end of turn.")).toEqual(["wipe"]);
  });

  it("lets one card fill several roles", () => {
    expect(roles("Creature — Elf", "{T}: Add {G}. When this creature enters, draw a card.")).toEqual(["ramp", "draw"]);
  });

  it("ignores reminder text, lands and cards without text", () => {
    expect(roles("Creature — Soldier", "Vigilance (Attacking doesn't cause this creature to tap. Draw a card.)")).toEqual([]);
    expect(roles("Land", "{T}: Add {G}.")).toEqual([]);
    expect(roles("Instant", null)).toEqual([]);
  });
});

const card = (over: Partial<AnalyzedCard> & { name: string }): AnalyzedCard => ({
  typeLine: "Creature — Bear",
  cmc: 2,
  board: "main",
  quantity: 1,
  oracleText: null,
  colorIdentity: [],
  ...over,
});

/** A legal-sized deck: a commander, `lands` basic Forests and filler creatures up to 99 cards in total. */
function deck(over: { lands?: number; extra?: AnalyzedCard[]; commander?: AnalyzedCard | null } = {}) {
  const lands = over.lands ?? 37;
  const extra = over.extra ?? [];
  const commander =
    over.commander === undefined
      ? card({ name: "Atraxa", board: "commander", cmc: 4, colorIdentity: ["W", "U", "B", "G"], typeLine: "Legendary Creature — Angel" })
      : over.commander;
  const filler = 99 - lands - extra.reduce((n, c) => n + c.quantity, 0);
  return [
    ...(commander ? [commander] : []),
    card({ name: "Forest", typeLine: "Basic Land — Forest", cmc: 0, quantity: lands, colorIdentity: ["G"] }),
    ...extra,
    ...Array.from({ length: filler }, (_, i) => card({ name: `Bear ${i}`, cmc: 3, colorIdentity: ["G"] })),
  ];
}

describe("analyzeCommanderDeck", () => {
  it("counts lands and spells, ignoring the commander", () => {
    const a = analyzeCommanderDeck(deck());
    expect(a.size).toBe(100);
    expect(a.lands).toBe(37);
    expect(a.spells).toBe(62);
    expect(a.commanders).toEqual(["Atraxa"]);
    expect(a.identity).toEqual(["W", "U", "B", "G"]);
  });

  it("averages the mana value of the spells only and builds the curve with a last slot for 7 or more", () => {
    const a = analyzeCommanderDeck([
      card({ name: "A", cmc: 1 }),
      card({ name: "B", cmc: 3, quantity: 1 }),
      card({ name: "C", cmc: 9 }),
      card({ name: "Land", typeLine: "Land", cmc: 0, quantity: 5 }),
    ]);
    expect(a.averageMv).toBeCloseTo(13 / 3);
    expect(a.curve).toEqual([0, 1, 0, 1, 0, 0, 0, 1]);
  });

  it("has no average without spells", () => {
    expect(analyzeCommanderDeck([]).averageMv).toBe(0);
  });

  it("counts roles by copies and counts cheap ramp or draw once even when a card does both", () => {
    const a = analyzeCommanderDeck([
      card({ name: "Sol Ring", typeLine: "Artifact", cmc: 1, oracleText: "{T}: Add {C}{C}." }),
      card({ name: "Elf", cmc: 2, oracleText: "{T}: Add {G}. When this creature enters, draw a card." }),
      card({ name: "Cultivate", typeLine: "Sorcery", cmc: 3, oracleText: "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle." }),
    ]);
    expect(a.roles).toMatchObject({ ramp: 3, draw: 1, removal: 0, wipe: 0 });
    expect(a.cheapRampOrDraw).toBe(2);
  });

  describe("rules", () => {
    const codes = (cards: AnalyzedCard[]) => analyzeCommanderDeck(cards).warnings.filter((w) => w.kind === "rule").map((w) => w.code);

    it("accepts a 100-card deck within the commander's colors", () => {
      expect(codes(deck())).toEqual([]);
    });

    it("flags a deck that is not 100 cards", () => {
      const w = analyzeCommanderDeck(deck().slice(0, -3)).warnings.find((x) => x.code === "size");
      expect(w?.params).toEqual({ count: 97 });
    });

    it("flags a missing commander and more than two", () => {
      expect(codes(deck({ commander: null }))).toContain("no-commander");
      const three = [
        ...deck({ commander: null }),
        card({ name: "C1", board: "commander" }),
        card({ name: "C2", board: "commander" }),
        card({ name: "C3", board: "commander" }),
      ];
      expect(analyzeCommanderDeck(three).warnings.find((x) => x.code === "many-commanders")?.params).toEqual({ count: 3 });
    });

    it("lists the cards outside the commander's color identity", () => {
      const w = analyzeCommanderDeck(deck({ extra: [card({ name: "Lightning Bolt", typeLine: "Instant", colorIdentity: ["R"] })] })).warnings.find((x) => x.code === "colors");
      expect(w?.params).toEqual({ count: 1, names: "Lightning Bolt" });
    });

    it("flags repeated cards, except basic lands and cards that allow any number", () => {
      const repeated = analyzeCommanderDeck(deck({ extra: [card({ name: "Doubled", quantity: 2, colorIdentity: ["G"] })] })).warnings.find((x) => x.code === "copies");
      expect(repeated?.params).toEqual({ count: 1, names: "Doubled" });
      const allowed = deck({
        extra: [card({ name: "Rat Colony", quantity: 4, oracleText: "A deck can have any number of cards named Rat Colony.", colorIdentity: ["G"] })],
      });
      expect(codes(allowed)).toEqual([]);
    });

    it("shortens long lists of names", () => {
      const many = Array.from({ length: 9 }, (_, i) => card({ name: `Red ${i}`, colorIdentity: ["R"] }));
      const w = analyzeCommanderDeck(deck({ extra: many })).warnings.find((x) => x.code === "colors");
      expect(w?.params.count).toBe(9);
      expect(String(w?.params.names)).toMatch(/…$/);
    });
  });

  describe("advice", () => {
    const advice = (cards: AnalyzedCard[]) => analyzeCommanderDeck(cards).warnings.filter((w) => w.kind === "advice");

    it("compares the lands with Karsten's formula", () => {
      // Average mana value 3 and no cheap ramp or draw: 31.42 + 9.39 = 40.81, so 41 lands.
      expect(analyzeCommanderDeck(deck({ lands: 37 })).suggestedLands).toBe(41);
      expect(advice(deck({ lands: 39 })).map((w) => w.code)).not.toContain("lands-low");
      expect(advice(deck({ lands: 30 })).find((w) => w.code === "lands-low")?.params).toEqual({ lands: 30, suggested: expect.any(Number) });
      expect(advice(deck({ lands: 48 })).map((w) => w.code)).toContain("lands-high");
    });

    it("flags roles below or above the usual range", () => {
      const low = advice(deck()).filter((w) => w.code === "role-low").map((w) => w.params.role);
      expect(low).toEqual(["ramp", "draw", "removal", "wipe"]);
      const wipes = Array.from({ length: 6 }, (_, i) =>
        card({ name: `Wipe ${i}`, typeLine: "Sorcery", cmc: 4, colorIdentity: [], oracleText: "Destroy all creatures." }),
      );
      expect(advice(deck({ extra: wipes })).find((w) => w.code === "role-high")?.params).toMatchObject({ role: "wipe", count: 6 });
    });

    it("says nothing about balance while the deck is still small", () => {
      expect(advice(deck().slice(0, 10))).toEqual([]);
    });
  });
});

describe("recommendedLands", () => {
  it("applies the formula and rounds", () => {
    expect(recommendedLands(3, 10)).toBe(38); // 31.42 + 9.39 - 2.8 = 38.01
    expect(recommendedLands(2.5, 0)).toBe(39);
  });

  it("keeps the threshold for cheap spells where the docs say it is", () => {
    expect(LAND_FORMULA.cheapMaxMv).toBe(2);
  });
});

describe("commander warnings", () => {
  it("flags a commander that cannot lead, and two commanders that cannot pair", () => {
    const bad = analyzeCommanderDeck(deck({ commander: card({ name: "Bolt", typeLine: "Instant", board: "commander" }) }));
    expect(bad.warnings.find((w) => w.code === "commander-invalid")?.params).toEqual({ count: 1, names: "Bolt" });
    const pair = analyzeCommanderDeck([
      ...deck({ commander: card({ name: "A", board: "commander", typeLine: "Legendary Creature — Elf" }) }),
      card({ name: "B", board: "commander", typeLine: "Legendary Creature — Elf" }),
    ]);
    expect(pair.warnings.find((w) => w.code === "commander-pair")?.params).toEqual({ names: "A + B" });
  });
});

describe("cardProblems", () => {
  const withId = (c: AnalyzedCard) => ({ ...c, oracleId: c.name });
  const problems = (cards: AnalyzedCard[]) => cardProblems(cards.map(withId));

  it("marks a card outside the commander's colors with the colors that are not allowed", () => {
    const list = deck({ commander: card({ name: "Cmd", board: "commander", colorIdentity: ["G"], typeLine: "Legendary Creature — Elf" }), extra: [card({ name: "Bolt", typeLine: "Instant", colorIdentity: ["R", "G"] })] });
    expect(problems(list).get("main:Bolt")).toEqual([{ code: "outside-identity", params: { colors: "R" } }]);
    expect(problems(list).has("main:Bear 0")).toBe(false);
  });

  it("marks repeated copies, the commander repeated in the main board, and a commander that cannot lead", () => {
    const cmd = card({ name: "Cmd", board: "commander", colorIdentity: ["G"], typeLine: "Legendary Creature — Elf" });
    const list = [cmd, card({ name: "Cmd", colorIdentity: ["G"], typeLine: "Legendary Creature — Elf" }), card({ name: "Twice", quantity: 2, colorIdentity: ["G"] })];
    const found = problems(list);
    expect(found.get("main:Cmd")?.map((p) => p.code)).toEqual(["duplicates-commander"]);
    expect(found.get("main:Twice")).toEqual([{ code: "copies", params: { count: 2 } }]);
    expect(problems([card({ name: "Bolt", typeLine: "Instant", board: "commander" })]).get("commander:Bolt")?.[0]?.code).toBe("bad-commander");
  });

  it("says nothing about colors while there is no commander", () => {
    expect(problems([card({ name: "Bolt", typeLine: "Instant", colorIdentity: ["R"] })]).size).toBe(0);
  });
});
