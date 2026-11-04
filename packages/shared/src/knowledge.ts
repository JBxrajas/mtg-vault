/**
 * Commander deckbuilding knowledge: numbers and sources the deck analysis relies on.
 *
 * Every figure says where it comes from and how much to trust it. Most of this is community advice,
 * not rules: show it as a guide. The explanation of each figure is in docs/knowledge/commander.md.
 */

/** How solid a source is: `official` rules from Wizards, `simulation` results, `community` consensus, `assumption` ours. */
export type Confidence = "official" | "simulation" | "community" | "assumption";

export interface KnowledgeSource {
  title: string;
  url: string;
  confidence: Confidence;
}

export const SOURCES = {
  karsten: {
    title: "Frank Karsten, How Many Lands Do You Need in Your Deck? An Updated Analysis (ChannelFireball)",
    url: "https://strategy.channelfireball.com/home/how-many-lands-do-you-need-in-your-deck-an-updated-analysis",
    // Known through secondary summaries (the original page could not be read when this was written).
    confidence: "simulation",
  },
  landSimulation: {
    title: "ScrollVault, How Many Lands in Commander? (3.75 million simulated games)",
    url: "https://scrollvault.net/guides/commander-land-count-data.html",
    confidence: "simulation",
  },
  template: {
    title: "metagame.info, How to build a Commander deck from scratch",
    url: "https://metagame.info/en-us/mtg/articles/how-to-build-a-commander-deck-from-scratch",
    confidence: "community",
  },
  brackets: {
    title: "Wizards of the Coast, Introducing Commander Brackets Beta",
    url: "https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta",
    confidence: "official",
  },
} as const satisfies Record<string, KnowledgeSource>;

export type SourceId = keyof typeof SOURCES;

/**
 * Karsten's formula for the lands of a 99-card deck (the commander is not counted):
 * `base + perAverageMv × average mana value of the spells − perCheapSpell × cheap ramp or card draw spells`.
 */
export const LAND_FORMULA = {
  base: 31.42,
  perAverageMv: 3.13,
  perCheapSpell: 0.28,
  /**
   * Highest mana value that counts as "cheap". The sources read do not give a threshold: this is our
   * assumption, and it leans towards suggesting slightly more lands.
   */
  cheapMaxMv: 2,
  source: "karsten",
} as const;

/** Lands the formula suggests for a spell base with this average mana value and this many cheap ramp or draw spells. */
export function recommendedLands(averageMv: number, cheapRampOrDraw: number): number {
  const { base, perAverageMv, perCheapSpell } = LAND_FORMULA;
  return Math.round(base + perAverageMv * averageMv - perCheapSpell * cheapRampOrDraw);
}

/** Roles the analysis counts. A card can fill more than one. */
export const ROLES = ["ramp", "draw", "removal", "wipe"] as const;
export type Role = (typeof ROLES)[number];

/** Copies per role that decks usually run (community consensus, ranges differ between sources). */
export const ROLE_TARGETS: Record<Role, { min: number; max: number }> = {
  ramp: { min: 8, max: 12 },
  draw: { min: 8, max: 12 },
  removal: { min: 6, max: 10 },
  wipe: { min: 2, max: 4 },
};
export const ROLE_TARGETS_SOURCE: SourceId = "template";

/** A deck with fewer cards than this is still being built: advice about its balance would only be noise. */
export const ADVICE_MIN_CARDS = 60;

/** A deck is flagged when its lands differ from the formula by more than this. */
export const LAND_TOLERANCE = 3;

export type BracketLevel = 1 | 2 | 3 | 4 | 5;

export interface Bracket {
  level: BracketLevel;
  /** Game Changers allowed in the deck; null for no limit (only the banned list applies). */
  gameChangerLimit: number | null;
}

/** The five Commander Brackets (official, in beta). The Game Changers list itself changes; it is not stored here. */
export const BRACKETS: readonly Bracket[] = [
  { level: 1, gameChangerLimit: 0 },
  { level: 2, gameChangerLimit: 0 },
  { level: 3, gameChangerLimit: 3 },
  { level: 4, gameChangerLimit: null },
  { level: 5, gameChangerLimit: null },
];
export const BRACKETS_SOURCE: SourceId = "brackets";
