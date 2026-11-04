import { z } from "zod";

export const conditionSchema = z.enum(["NM", "LP", "MP", "HP", "DMG"]);
export type Condition = z.infer<typeof conditionSchema>;

/** Physical finish of an owned card. Matches the `finishes` Scryfall lists per printing. */
export const finishSchema = z.enum(["nonfoil", "foil", "etched"]);
export type Finish = z.infer<typeof finishSchema>;

/** One stack of identical cards in a collection: same printing, finish, condition and language. */
export const collectionEntrySchema = z.object({
  printingId: z.string().uuid(),
  quantity: z.number().int().positive(),
  finish: finishSchema.default("nonfoil"),
  condition: conditionSchema.default("NM"),
  language: z.string().default("en"),
  purchasePrice: z.number().nonnegative().optional(),
});
export type CollectionEntry = z.infer<typeof collectionEntrySchema>;

export const colorSchema = z.enum(["W", "U", "B", "R", "G"]);
export type Color = z.infer<typeof colorSchema>;

export const cardSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Substring of the type line, for example "creature". */
  type: z.string().trim().min(1).max(50).optional(),
  /** Comma-separated colors the card's identity must include, for example "R,G". */
  colors: z
    .string()
    .transform((v) => v.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))
    .pipe(z.array(colorSchema).max(5))
    .optional(),
});
export type CardSearchQuery = z.infer<typeof cardSearchQuerySchema>;

/** Scryfall image URLs for one printing; hotlinked, not stored by us. */
export interface CardImage {
  /** Small card image, for lists. */
  small: string;
  /** Regular card image, for a detail view. */
  normal: string;
  /** Just the artwork, cropped by Scryfall. */
  artCrop: string;
}

export interface CardSearchResult {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  /** Trigram similarity to the query, 0 to 1. */
  similarity: number;
  /** Image of the most recent printing that has one, or null. */
  image: CardImage | null;
}

export * from "./decks.js";

/** Latest known prices of a printing. Null where Scryfall has none (for example no etched price). */
export interface PrintingPrices {
  usd: number | null;
  usdFoil: number | null;
  usdEtched: number | null;
  eur: number | null;
  eurFoil: number | null;
  tix: number | null;
}

/** One printing of a card, for the "all versions" list. */
export interface PrintingSummary {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  lang: string;
  rarity: string;
  /** ISO date, or null. */
  releasedAt: string | null;
  finishes: string[];
  image: CardImage | null;
  /** Latest snapshot, or null when no price has been recorded yet. */
  prices: PrintingPrices | null;
  /** Date of that snapshot (ISO), or null. */
  pricesOn: string | null;
}

export const oracleIdParamSchema = z.object({ oracleId: z.string().uuid() });
