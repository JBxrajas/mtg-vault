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

export interface CardSearchResult {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  /** Trigram similarity to the query, 0 to 1. */
  similarity: number;
}

export * from "./decks.js";
