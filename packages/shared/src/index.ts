import { z } from "zod";
import { conditionSchema, finishSchema, type Condition, type Finish } from "./primitives.js";

export * from "./primitives.js";


/** One stack of identical cards in a collection: same printing, finish, condition and language. */
export const collectionEntrySchema = z.object({
  printingId: z.string().uuid(),
  quantity: z.number().int().positive().max(9999),
  finish: finishSchema.default("nonfoil"),
  condition: conditionSchema.default("NM"),
  language: z.string().trim().min(2).max(5).default("en"),
  /** Price paid per copy, in USD. */
  purchasePrice: z.number().nonnegative().max(1_000_000).optional(),
  /** ISO date (YYYY-MM-DD). */
  acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CollectionEntry = z.infer<typeof collectionEntrySchema>;

/** Fields of a stack that can change after it exists. Condition, finish and language identify the stack: remove and add instead. */
export const updateCollectionItemSchema = z
  .object({
    quantity: z.number().int().positive().max(9999),
    purchasePrice: z.number().nonnegative().max(1_000_000).nullable(),
    acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Send at least one field to change");
export type UpdateCollectionItem = z.infer<typeof updateCollectionItemSchema>;

export const itemIdParamSchema = z.object({ id: z.string().uuid() });

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
  /** Rules text, for checks such as "can be your commander". */
  oracleText: string | null;
  colorIdentity: Color[];
  /** Trigram similarity to the query, 0 to 1. */
  similarity: number;
  /** Image of the most recent printing that has one, or null. */
  image: CardImage | null;
}

export * from "./analysis.js";
export * from "./commander.js";
export * from "./csv.js";
export * from "./decklist.js";
export * from "./decks.js";
export * from "./export.js";
export * from "./import.js";
export * from "./knowledge.js";

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

/** Username: letters, digits, underscore and dot. Stored lower-case; the original is kept for display. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters")
  .max(30, "Use at most 30 characters")
  .regex(/^[A-Za-z0-9_.]+$/, "Use only letters, digits, underscore or dot (no spaces, no @)");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters");

export const registerSchema = z.object({ username: usernameSchema, password: passwordSchema });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
export type LoginInput = z.infer<typeof loginSchema>;

/** The signed-in user, as `GET /me` returns it. */
export interface CurrentUser {
  id: string;
  username: string;
  displayUsername: string;
}

/**
 * Better Auth requires an email on every user. Username-only accounts get this reserved-domain
 * address (`.invalid` never receives mail). See docs/adr/0008-users-collection-binders-decks.md.
 */
export const syntheticEmail = (username: string) => `${username.trim().toLowerCase()}@users.invalid`;

/** A stack in the signed-in user's collection, with the card and its latest price. */
export interface CollectionItem {
  id: string;
  printingId: string;
  oracleId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  finish: Finish;
  condition: Condition;
  language: string;
  quantity: number;
  /** Price paid per copy (USD), or null. */
  purchasePrice: number | null;
  acquiredOn: string | null;
  notes: string | null;
  image: CardImage | null;
  /** Latest market price per copy in USD for this finish, or null when unknown. */
  unitPrice: number | null;
  pricesOn: string | null;
}

/** Market price in USD of one copy with the given finish; null when that finish has no price. */
export function unitPriceUsd(finish: Finish, prices: PrintingPrices | null): number | null {
  if (!prices) return null;
  return finish === "foil" ? prices.usdFoil : finish === "etched" ? prices.usdEtched : prices.usd;
}

/** Totals for a list of stacks. Copies without a price count as `unpriced`. */
export function collectionTotals(items: Pick<CollectionItem, "quantity" | "unitPrice">[]) {
  let copies = 0;
  let unpriced = 0;
  let valueUsd = 0;
  for (const item of items) {
    copies += item.quantity;
    if (item.unitPrice == null) unpriced += item.quantity;
    else valueUsd += item.unitPrice * item.quantity;
  }
  return { stacks: items.length, copies, unpriced, valueUsd: Math.round(valueUsd * 100) / 100 };
}
