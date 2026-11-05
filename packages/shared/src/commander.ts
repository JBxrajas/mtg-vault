import type { Color } from "./index.js";

/** What the commander rules read from a card. */
export interface CommanderCandidate {
  name: string;
  typeLine: string;
  oracleText: string | null;
}

const frontFace = (text: string) => text.split("//")[0] ?? "";

/**
 * How a card can lead a Commander deck: `commander` (a legendary creature, or a card that says it can be your
 * commander), `background` (a legendary Background, which pairs with a card that can choose one), or null when it
 * cannot. Only the front face counts. Legendary Vehicles and Spacecraft need a power and toughness, which this
 * data does not carry, so they count only when their text says so.
 */
export function commanderRole(card: Pick<CommanderCandidate, "typeLine" | "oracleText">): "commander" | "background" | null {
  const front = frontFace(card.typeLine);
  const legendary = /\bLegendary\b/.test(front);
  if (legendary && /\bBackground\b/.test(front)) return "background";
  if (legendary && /\bCreature\b/.test(front)) return "commander";
  if (/can be your commander/i.test(card.oracleText ?? "")) return "commander";
  return null;
}

/** Why a card cannot be the commander, as a short code the interface turns into text. */
export function commanderRefusal(card: Pick<CommanderCandidate, "typeLine" | "oracleText">): "not-legendary" | "not-creature" | null {
  if (commanderRole(card)) return null;
  return /\bLegendary\b/.test(frontFace(card.typeLine)) ? "not-creature" : "not-legendary";
}

const text = (c: CommanderCandidate) => c.oracleText ?? "";
const hasPlainPartner = (c: CommanderCandidate) => /^partner\b(?! with)/im.test(text(c)) && !/^partner with/im.test(text(c));
const partnerWith = (c: CommanderCandidate) => /^partner with ([^\n(]+)/im.exec(text(c))?.[1]?.trim().toLowerCase();

/**
 * Whether two cards may lead one deck together: both have Partner, each names the other with "Partner with",
 * both say Friends forever, a card that can choose a Background with a Background, or a Doctor's companion with a
 * Time Lord Doctor. Returns false when they may not.
 */
export function canPartner(a: CommanderCandidate, b: CommanderCandidate): boolean {
  if (hasPlainPartner(a) && hasPlainPartner(b)) return true;
  if (partnerWith(a) === a.name.toLowerCase() || partnerWith(b) === b.name.toLowerCase()) return false;
  if (partnerWith(a) === b.name.toLowerCase() && partnerWith(b) === a.name.toLowerCase()) return true;
  if (/friends forever/i.test(text(a)) && /friends forever/i.test(text(b))) return true;
  const chooses = (c: CommanderCandidate) => /choose a background/i.test(text(c));
  const background = (c: CommanderCandidate) => commanderRole(c) === "background";
  if ((chooses(a) && background(b)) || (chooses(b) && background(a))) return true;
  const companion = (c: CommanderCandidate) => /doctor's companion/i.test(text(c));
  const doctor = (c: CommanderCandidate) => /\bTime Lord Doctor\b/.test(frontFace(c.typeLine));
  return (companion(a) && doctor(b)) || (companion(b) && doctor(a));
}

const IDENTITY_NAMES: Record<string, string> = {
  "": "Colorless",
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  WU: "Azorius",
  UB: "Dimir",
  BR: "Rakdos",
  RG: "Gruul",
  WG: "Selesnya",
  WB: "Orzhov",
  UR: "Izzet",
  BG: "Golgari",
  WR: "Boros",
  UG: "Simic",
  WUB: "Esper",
  UBR: "Grixis",
  BRG: "Jund",
  WRG: "Naya",
  WUG: "Bant",
  WBG: "Abzan",
  WUR: "Jeskai",
  UBG: "Sultai",
  WBR: "Mardu",
  URG: "Temur",
  WUBR: "Yore-Tiller (no green)",
  UBRG: "Glint-Eye (no white)",
  WBRG: "Dune-Brood (no blue)",
  WURG: "Ink-Treader (no black)",
  WUBG: "Witch-Maw (no red)",
  WUBRG: "Five-color",
};

const ORDER: Color[] = ["W", "U", "B", "R", "G"];

/** Common name of a color identity: "Temur" for blue, red and green; "Colorless" for none. Colors may come in any order. */
export function colorIdentityName(colors: readonly Color[]): string {
  const key = ORDER.filter((c) => colors.includes(c)).join("");
  return IDENTITY_NAMES[key] ?? key;
}

/** The color words of an identity, in WUBRG order: ["Blue", "Red", "Green"]. */
export function colorWords(colors: readonly Color[]): string[] {
  return ORDER.filter((c) => colors.includes(c)).map((c) => IDENTITY_NAMES[c]!);
}

/** Whether a card can take a second commander at all (Partner, Partner with, Friends forever, Choose a Background, Doctor's companion). */
export function hasPartnerAbility(card: Pick<CommanderCandidate, "typeLine" | "oracleText">): boolean {
  return /^partner\b|friends forever|choose a background|doctor's companion/im.test(card.oracleText ?? "");
}
