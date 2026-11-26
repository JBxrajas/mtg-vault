import { z } from "zod";

/**
 * Bids placed in auctions that run outside the app (Magic auctions in Facebook groups).
 * Amounts are Mexican pesos, the currency those groups use.
 *
 * - winning / losing: the auction is open and the user has (or no longer has) the highest bid.
 * - won / lost: the auction closed.
 * - paid: won and paid, not yet in hand.
 * - picked_up: in hand (the end of the line).
 */
export const auctionStatusSchema = z.enum(["winning", "losing", "won", "lost", "paid", "picked_up"]);
export type AuctionStatus = z.infer<typeof auctionStatusSchema>;

export const OPEN_AUCTION_STATUSES: readonly AuctionStatus[] = ["winning", "losing"];
export const isOpenAuction = (s: AuctionStatus) => s === "winning" || s === "losing";

const money = z.number().nonnegative().max(1_000_000);
const shortText = (max: number) => z.string().trim().max(max);
/** An ISO timestamp with an offset or Z, as `Date#toISOString` writes it. */
const instant = z.string().datetime({ offset: true });
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((v) => /^https?:\/\//i.test(v), "Use an http or https link");

const auctionFields = {
  cardName: z.string().trim().min(1).max(200),
  oracleId: z.string().uuid().nullable(),
  printingId: z.string().uuid().nullable(),
  groupName: shortText(200).nullable(),
  seller: shortText(200).nullable(),
  postUrl: httpUrl.nullable(),
  myBid: money.nullable(),
  highBid: money.nullable(),
  highBidder: shortText(200).nullable(),
  maxBid: money.nullable(),
  closesAt: instant.nullable(),
  status: auctionStatusSchema,
  pickupPlace: shortText(200).nullable(),
  pickupAt: instant.nullable(),
  deckId: z.string().uuid().nullable(),
  notes: shortText(1000).nullable(),
};

/** A new bid. Only the card name is required; the rest can be filled in as the auction goes on. */
export const auctionInputSchema = z.object(auctionFields).partial().required({ cardName: true }).extend({
  status: auctionStatusSchema.default("winning"),
});
export type AuctionInput = z.input<typeof auctionInputSchema>;

/** Fields to change on a bid; null clears an optional field. */
export const auctionUpdateSchema = z
  .object(auctionFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Send at least one field to change");
export type AuctionUpdate = z.infer<typeof auctionUpdateSchema>;

export const auctionIdParamSchema = z.object({ id: z.string().uuid() });

export interface AuctionBid {
  id: string;
  cardName: string;
  oracleId: string | null;
  printingId: string | null;
  groupName: string | null;
  seller: string | null;
  postUrl: string | null;
  myBid: number | null;
  highBid: number | null;
  highBidder: string | null;
  maxBid: number | null;
  /** ISO timestamp. */
  closesAt: string | null;
  status: AuctionStatus;
  pickupPlace: string | null;
  /** ISO timestamp. */
  pickupAt: string | null;
  deckId: string | null;
  deckName: string | null;
  /** Small picture of the linked printing (or the card's first printing); null when not linked. */
  image: { small: string; normal: string; artCrop: string } | null;
  notes: string | null;
  updatedAt: string;
}

/** What a won card costs: the user's own bid, else the highest bid recorded. */
export const auctionPrice = (b: Pick<AuctionBid, "myBid" | "highBid">): number => b.myBid ?? b.highBid ?? 0;

export interface AuctionTotals {
  /** Spent if every auction now winning is won, plus what is won and still unpaid. */
  committed: number;
  winning: number;
  losing: number;
  /** Won and not paid yet. */
  toPay: { count: number; amount: number };
  /** Won or paid, not picked up yet. */
  toPickUp: { count: number; amount: number };
}

export function auctionTotals(bids: Pick<AuctionBid, "status" | "myBid" | "highBid">[]): AuctionTotals {
  const totals: AuctionTotals = { committed: 0, winning: 0, losing: 0, toPay: { count: 0, amount: 0 }, toPickUp: { count: 0, amount: 0 } };
  for (const b of bids) {
    const price = auctionPrice(b);
    if (b.status === "winning") {
      totals.winning++;
      totals.committed += b.myBid ?? 0;
    } else if (b.status === "losing") {
      totals.losing++;
    } else if (b.status === "won") {
      totals.committed += price;
      totals.toPay.count++;
      totals.toPay.amount += price;
    }
    if (b.status === "won" || b.status === "paid") {
      totals.toPickUp.count++;
      totals.toPickUp.amount += price;
    }
  }
  return totals;
}

/** How close "closing soon" is. */
export const CLOSING_SOON_MS = 60 * 60 * 1000;

export type AuctionAlert =
  /** Open, and the closing time has passed: the status needs updating. */
  | "closed"
  /** Losing, and the highest bid is already at or over the maximum: let it go. */
  | "overMax"
  | "losing"
  | "closingSoon";

/** The flags to highlight a bid with, most urgent first. Closed auctions have none. */
export function auctionAlerts(
  b: Pick<AuctionBid, "status" | "closesAt" | "highBid" | "maxBid">,
  now: number,
): AuctionAlert[] {
  if (!isOpenAuction(b.status)) return [];
  const alerts: AuctionAlert[] = [];
  const left = b.closesAt ? Date.parse(b.closesAt) - now : null;
  if (left != null && left <= 0) alerts.push("closed");
  if (b.status === "losing") {
    if (b.highBid != null && b.maxBid != null && b.highBid >= b.maxBid) alerts.push("overMax");
    alerts.push("losing");
  }
  if (left != null && left > 0 && left <= CLOSING_SOON_MS) alerts.push("closingSoon");
  return alerts;
}

const STATUS_RANK: Record<AuctionStatus, number> = { winning: 0, losing: 0, won: 1, paid: 2, picked_up: 3, lost: 4 };

/**
 * Open auctions first, by closing time (soonest first, no time last); then won, paid, picked up and lost,
 * each by closing time too. Does not change the input.
 */
export function sortAuctions<T extends Pick<AuctionBid, "status" | "closesAt" | "cardName">>(bids: T[]): T[] {
  const time = (b: T) => (b.closesAt ? Date.parse(b.closesAt) : Number.POSITIVE_INFINITY);
  return [...bids].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || time(a) - time(b) || a.cardName.localeCompare(b.cardName),
  );
}

/** Time left as parts, for a countdown. Null when there is no closing time; all zero once it has passed. */
export function timeLeft(closesAt: string | null, now: number): { days: number; hours: number; minutes: number; seconds: number; ms: number } | null {
  if (!closesAt) return null;
  const ms = Math.max(0, Date.parse(closesAt) - now);
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60, ms };
}
