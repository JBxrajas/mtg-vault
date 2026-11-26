import { describe, expect, it } from "vitest";
import {
  auctionAlerts,
  auctionInputSchema,
  auctionTotals,
  auctionUpdateSchema,
  sortAuctions,
  timeLeft,
  type AuctionStatus,
} from "./auctions.js";

const bid = (status: AuctionStatus, myBid: number | null, highBid: number | null = myBid) => ({ status, myBid, highBid });

describe("auctionTotals", () => {
  it("adds up what is committed, to pay and to pick up", () => {
    const t = auctionTotals([
      bid("winning", 100),
      bid("winning", 50),
      bid("losing", 30, 60),
      bid("won", 80),
      bid("won", null, 40), // no own bid recorded: the highest bid is the price
      bid("paid", 70),
      bid("picked_up", 500),
      bid("lost", 20, 90),
    ]);
    expect(t.committed).toBe(100 + 50 + 80 + 40);
    expect(t.winning).toBe(2);
    expect(t.losing).toBe(1);
    expect(t.toPay).toEqual({ count: 2, amount: 120 });
    expect(t.toPickUp).toEqual({ count: 3, amount: 190 });
  });

  it("is all zero for no bids", () => {
    expect(auctionTotals([])).toEqual({ committed: 0, winning: 0, losing: 0, toPay: { count: 0, amount: 0 }, toPickUp: { count: 0, amount: 0 } });
  });
});

describe("auctionAlerts", () => {
  const now = Date.parse("2026-11-25T20:00:00Z");
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

  it("flags losing and closing within the hour", () => {
    expect(auctionAlerts({ status: "losing", closesAt: at(30), highBid: 100, maxBid: 150 }, now)).toEqual(["losing", "closingSoon"]);
    expect(auctionAlerts({ status: "winning", closesAt: at(59), highBid: 100, maxBid: 150 }, now)).toEqual(["closingSoon"]);
    expect(auctionAlerts({ status: "winning", closesAt: at(61), highBid: 100, maxBid: 150 }, now)).toEqual([]);
  });

  it("says when the highest bid has reached the maximum", () => {
    expect(auctionAlerts({ status: "losing", closesAt: null, highBid: 150, maxBid: 150 }, now)).toEqual(["overMax", "losing"]);
  });

  it("says an open auction whose time passed needs updating, and leaves closed ones alone", () => {
    expect(auctionAlerts({ status: "winning", closesAt: at(-1), highBid: null, maxBid: null }, now)).toEqual(["closed"]);
    for (const status of ["won", "lost", "paid", "picked_up"] as const) {
      expect(auctionAlerts({ status, closesAt: at(10), highBid: 200, maxBid: 100 }, now)).toEqual([]);
    }
  });
});

describe("sortAuctions", () => {
  it("puts open auctions first by closing time, then won, paid, picked up and lost", () => {
    const rows = [
      { cardName: "Lost", status: "lost" as const, closesAt: "2026-11-20T00:00:00Z" },
      { cardName: "No time", status: "winning" as const, closesAt: null },
      { cardName: "Later", status: "losing" as const, closesAt: "2026-11-26T22:59:00Z" },
      { cardName: "Won", status: "won" as const, closesAt: "2026-11-24T00:00:00Z" },
      { cardName: "Soon", status: "winning" as const, closesAt: "2026-11-25T21:59:00Z" },
      { cardName: "Picked", status: "picked_up" as const, closesAt: "2026-11-01T00:00:00Z" },
      { cardName: "Paid", status: "paid" as const, closesAt: "2026-11-23T00:00:00Z" },
    ];
    expect(sortAuctions(rows).map((r) => r.cardName)).toEqual(["Soon", "Later", "No time", "Won", "Paid", "Picked", "Lost"]);
    expect(rows[0]!.cardName).toBe("Lost");
  });
});

describe("timeLeft", () => {
  it("splits the time left and stops at zero", () => {
    const now = Date.parse("2026-11-25T20:00:00Z");
    expect(timeLeft("2026-11-27T01:02:03Z", now)).toMatchObject({ days: 1, hours: 5, minutes: 2, seconds: 3 });
    expect(timeLeft("2026-11-25T19:00:00Z", now)).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, ms: 0 });
    expect(timeLeft(null, now)).toBeNull();
  });
});

describe("auction schemas", () => {
  it("needs only a card name and starts as winning", () => {
    expect(auctionInputSchema.parse({ cardName: " Goblin Bombardment " })).toEqual({ cardName: "Goblin Bombardment", status: "winning" });
    expect(auctionInputSchema.safeParse({}).success).toBe(false);
    expect(auctionInputSchema.safeParse({ cardName: "" }).success).toBe(false);
  });

  it("checks amounts, times, links and status", () => {
    const ok = auctionInputSchema.safeParse({
      cardName: "Mirror Gallery",
      postUrl: "https://www.facebook.com/groups/1/posts/2",
      myBid: 150,
      maxBid: 190,
      closesAt: "2026-11-26T03:59:00.000Z",
      status: "losing",
    });
    expect(ok.success).toBe(true);
    expect(auctionInputSchema.safeParse({ cardName: "x", myBid: -1 }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ cardName: "x", closesAt: "tomorrow" }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ cardName: "x", postUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(auctionInputSchema.safeParse({ cardName: "x", status: "sold" }).success).toBe(false);
  });

  it("updates need at least one field and accept null to clear", () => {
    expect(auctionUpdateSchema.safeParse({}).success).toBe(false);
    expect(auctionUpdateSchema.parse({ deckId: null, status: "picked_up" })).toEqual({ deckId: null, status: "picked_up" });
  });
});
