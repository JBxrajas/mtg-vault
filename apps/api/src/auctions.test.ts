import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("./db.js", () => ({ getDb: () => ({ execute }) }));

const { checkLinks, toAuctionBid } = await import("./auctions.js");
const { HttpError } = await import("./collection.js");

const ORACLE = "4457ed35-7c10-48c8-9776-456485fdf070";
const OTHER = "11111111-1111-4111-8111-111111111111";
const PRINTING = "22222222-2222-4222-8222-222222222222";
const DECK = "33333333-3333-4333-8333-333333333333";

beforeEach(() => execute.mockReset());

describe("toAuctionBid", () => {
  it("maps columns, converts amounts and serialises the times", () => {
    const bid = toAuctionBid({
      id: "b1",
      card_name: "Mirror Gallery",
      oracle_id: ORACLE,
      printing_id: null,
      group_name: "Magic CDMX",
      seller: "Ana",
      post_url: "https://www.facebook.com/groups/1/posts/2",
      my_bid: "150.00",
      high_bid: "160.00",
      high_bidder: "Luis",
      max_bid: "190.00",
      closes_at: new Date("2026-11-26T03:59:00Z"),
      status: "losing",
      pickup_place: "Teatro Blanquita",
      pickup_at: "2026-11-28 18:00:00+00",
      deck_id: DECK,
      deck_name: "Deadpool",
      image_uris: { small: "s", normal: "n", art_crop: "a", back: { small: "bs", normal: "bn" } },
      notes: null,
      updated_at: new Date("2026-11-25T20:00:00Z"),
    });
    expect(bid).toMatchObject({
      myBid: 150,
      highBid: 160,
      maxBid: 190,
      closesAt: "2026-11-26T03:59:00.000Z",
      pickupAt: "2026-11-28T18:00:00.000Z",
      deckName: "Deadpool",
      image: { small: "s", normal: "n", artCrop: "a" },
      updatedAt: "2026-11-25T20:00:00.000Z",
    });
  });

  it("copes with an unlinked card and empty fields", () => {
    const bid = toAuctionBid({ id: "b1", card_name: "SLD Bolt", status: "winning", updated_at: "2026-11-25T20:00:00Z" });
    expect(bid).toMatchObject({ oracleId: null, myBid: null, closesAt: null, image: null, deckName: null });
  });
});

describe("checkLinks", () => {
  it("takes the card from the printing", async () => {
    execute.mockResolvedValueOnce([{ oracle_id: ORACLE }]);
    expect(await checkLinks("u1", { printingId: PRINTING })).toEqual({ printingId: PRINTING, oracleId: ORACLE });
  });

  it("refuses a printing of another card, and unknown printings or cards", async () => {
    execute.mockResolvedValueOnce([{ oracle_id: OTHER }]);
    await expect(checkLinks("u1", { printingId: PRINTING, oracleId: ORACLE })).rejects.toThrow("another card");
    execute.mockResolvedValueOnce([]);
    await expect(checkLinks("u1", { printingId: PRINTING })).rejects.toBeInstanceOf(HttpError);
    execute.mockResolvedValueOnce([]);
    await expect(checkLinks("u1", { oracleId: ORACLE })).rejects.toThrow("Card not found");
  });

  it("clears the printing when only the card changes", async () => {
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    expect(await checkLinks("u1", { oracleId: ORACLE })).toEqual({ oracleId: ORACLE, printingId: null });
    expect(await checkLinks("u1", { oracleId: null })).toEqual({ oracleId: null, printingId: null });
  });

  it("accepts only the user's own deck", async () => {
    execute.mockResolvedValueOnce([]);
    await expect(checkLinks("u1", { deckId: DECK })).rejects.toThrow("Deck not found");
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    expect(await checkLinks("u1", { deckId: DECK, status: "won" })).toEqual({ deckId: DECK, status: "won" });
  });

  it("does not query when nothing is linked", async () => {
    expect(await checkLinks("u1", { status: "paid", deckId: null })).toEqual({ status: "paid", deckId: null });
    expect(execute).not.toHaveBeenCalled();
  });
});
