import { describe, expect, it } from "vitest";
import { canPartner, colorIdentityName, colorWords, commanderRefusal, commanderRole, type CommanderCandidate } from "./commander.js";

const c = (name: string, typeLine: string, oracleText: string | null = null): CommanderCandidate => ({ name, typeLine, oracleText });

describe("commanderRole", () => {
  it("accepts legendary creatures, including the front face of a double-faced card", () => {
    expect(commanderRole(c("Atraxa", "Legendary Creature — Phyrexian Angel Horror"))).toBe("commander");
    expect(commanderRole(c("Delver", "Legendary Creature — Human // Legendary Creature — Insect"))).toBe("commander");
  });

  it("accepts a card that says it can be the commander, and a Background as a background", () => {
    expect(commanderRole(c("Teferi", "Legendary Planeswalker — Teferi", "Teferi can be your commander."))).toBe("commander");
    expect(commanderRole(c("Raised by Giants", "Legendary Enchantment — Background"))).toBe("background");
  });

  it("refuses the rest, saying why", () => {
    expect(commanderRole(c("Lightning Bolt", "Instant"))).toBeNull();
    expect(commanderRefusal(c("Lightning Bolt", "Instant"))).toBe("not-legendary");
    expect(commanderRefusal(c("Sol Ring", "Artifact"))).toBe("not-legendary");
    expect(commanderRefusal(c("Urza's Saga", "Legendary Enchantment Land"))).toBe("not-creature");
    expect(commanderRefusal(c("Atraxa", "Legendary Creature — Angel"))).toBeNull();
    // A creature that is only legendary on its back face does not count.
    expect(commanderRole(c("Front", "Creature — Human // Legendary Creature — Wolf"))).toBeNull();
  });
});

describe("canPartner", () => {
  const partner = (name: string) => c(name, "Legendary Creature — Human", "Partner (You can have two commanders if both have partner.)");

  it("pairs two cards with Partner", () => {
    expect(canPartner(partner("Tymna"), partner("Thrasios"))).toBe(true);
  });

  it("pairs Partner with only with the named card", () => {
    const a = c("Pir", "Legendary Creature — Human", "Partner with Toothy, Imaginary Friend\nIf a source would deal damage...");
    const b = c("Toothy, Imaginary Friend", "Legendary Creature — Illusion", "Partner with Pir, Imaginary Friend");
    const a2 = { ...a, name: "Pir, Imaginary Friend" };
    expect(canPartner(a2, b)).toBe(true);
    expect(canPartner(a2, partner("Tymna"))).toBe(false);
  });

  it("pairs Friends forever, Choose a Background and Doctor's companion", () => {
    const f = (n: string) => c(n, "Legendary Creature — Human", "Friends forever (You can have two commanders if both have friends forever.)");
    expect(canPartner(f("A"), f("B"))).toBe(true);
    const chooser = c("Wilson", "Legendary Creature — Bear", "Choose a Background");
    expect(canPartner(chooser, c("Raised by Giants", "Legendary Enchantment — Background"))).toBe(true);
    expect(canPartner(c("Rose", "Legendary Creature — Human", "Doctor's companion"), c("Ten", "Legendary Creature — Time Lord Doctor"))).toBe(true);
  });

  it("refuses two plain commanders", () => {
    expect(canPartner(c("A", "Legendary Creature — Elf"), c("B", "Legendary Creature — Elf"))).toBe(false);
    expect(canPartner(partner("Tymna"), c("B", "Legendary Creature — Elf"))).toBe(false);
  });
});

describe("colorIdentityName", () => {
  it("names the identity whatever the order", () => {
    expect(colorIdentityName([])).toBe("Colorless");
    expect(colorIdentityName(["R", "U", "G"])).toBe("Temur");
    expect(colorIdentityName(["W", "U", "B", "G"])).toBe("Witch-Maw (no red)");
    expect(colorIdentityName(["G", "B", "R", "U", "W"])).toBe("Five-color");
  });

  it("lists the color words in WUBRG order", () => {
    expect(colorWords(["G", "U"])).toEqual(["Blue", "Green"]);
  });
});
