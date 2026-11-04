import { z } from "zod";

export const deckFormatSchema = z.enum([
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "oathbreaker",
  "brawl",
  "pauper",
  "historic",
  "casual",
]);
export type DeckFormat = z.infer<typeof deckFormatSchema>;

/** Which part of the deck a card sits in. */
export const deckBoardSchema = z.enum(["main", "sideboard", "maybeboard", "commander"]);
export type DeckBoard = z.infer<typeof deckBoardSchema>;

export const deckCardSchema = z.object({
  oracleId: z.string().uuid(),
  quantity: z.number().int().positive(),
  board: deckBoardSchema.default("main"),
  /** Preferred printing for display; the deck itself is about the oracle card. */
  printingId: z.string().uuid().optional(),
});
export type DeckCard = z.infer<typeof deckCardSchema>;

export const deckInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  format: deckFormatSchema.default("casual"),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().default(false),
});
export type DeckInput = z.infer<typeof deckInputSchema>;

/** Groups a deck list is divided into, in display order. */
export const CARD_CATEGORIES = [
  "Commander",
  "Planeswalker",
  "Creature",
  "Sorcery",
  "Instant",
  "Artifact",
  "Enchantment",
  "Battle",
  "Land",
  "Other",
] as const;
export type CardCategory = (typeof CARD_CATEGORIES)[number];

/**
 * Detection priority when a card has several types: "Artifact Creature" is a Creature,
 * "Artifact Land" and "Dryad Arbor" are Lands. Display order is `CARD_CATEGORIES`.
 */
const DETECTION_ORDER = [
  "Land",
  "Creature",
  "Planeswalker",
  "Battle",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
] as const satisfies readonly CardCategory[];

/** Category of a card from its Scryfall type line. Only the front face of "A // B" cards counts. */
export function cardCategory(typeLine: string): CardCategory {
  const front = typeLine.split("//")[0] ?? "";
  const types = front.split("—")[0] ?? "";
  const words = new Set(types.split(/\s+/).filter(Boolean));
  return DETECTION_ORDER.find((c) => words.has(c)) ?? "Other";
}

export interface DeckListEntry {
  quantity: number;
  board: DeckBoard;
  typeLine: string;
}

/**
 * Splits a main-board list into display groups. Cards on the `commander` board form their
 * own "Commander" group; sideboard and maybeboard are not grouped here.
 * Empty groups are left out, and groups follow `CARD_CATEGORIES` order.
 */
export function groupByCategory<T extends DeckListEntry>(entries: T[]) {
  const groups = new Map<CardCategory, T[]>();
  for (const entry of entries) {
    if (entry.board === "sideboard" || entry.board === "maybeboard") continue;
    const category = entry.board === "commander" ? "Commander" : cardCategory(entry.typeLine);
    groups.set(category, [...(groups.get(category) ?? []), entry]);
  }
  return CARD_CATEGORIES.filter((c) => groups.has(c)).map((category) => {
    const items = groups.get(category)!;
    return { category, count: items.reduce((n, e) => n + e.quantity, 0), items };
  });
}
