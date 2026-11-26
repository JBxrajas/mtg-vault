// @vitest-environment jsdom
import type { AuctionBid } from "@mtg-vault/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, fetchAuctions, createAuction, updateAuction, deleteAuction, fetchDecks, searchCards, fetchPrintings, addToCollection } = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  fetchAuctions: vi.fn(),
  createAuction: vi.fn(),
  updateAuction: vi.fn(),
  deleteAuction: vi.fn(),
  fetchDecks: vi.fn(),
  searchCards: vi.fn(),
  fetchPrintings: vi.fn(),
  addToCollection: vi.fn(),
}));
vi.mock("./auth", () => ({ fetchMe }));
vi.mock("./auctionsApi", () => ({ fetchAuctions, createAuction, updateAuction, deleteAuction }));
vi.mock("./decksApi", () => ({ fetchDecks }));
vi.mock("./api", () => ({ searchCards, fetchPrintings }));
vi.mock("./collectionApi", () => ({ addToCollection }));

import { AuctionsPage } from "./AuctionsPage";
import { setCurrency } from "./currency";
import { setLocale } from "./i18n";
import { aCard, aDeck, aPrinting, aUser, renderPage } from "./test-utils";

const ORACLE = "4457ed35-7c10-48c8-9776-456485fdf070";
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

const aBid = (over: Partial<AuctionBid> = {}): AuctionBid => ({
  id: "b1",
  cardName: "Mirror Gallery",
  oracleId: null,
  printingId: null,
  groupName: "Magic CDMX",
  seller: "Ana",
  postUrl: "https://www.facebook.com/groups/1/posts/2",
  myBid: 150,
  highBid: 150,
  highBidder: null,
  maxBid: 190,
  closesAt: inMinutes(600),
  status: "winning",
  pickupPlace: null,
  pickupAt: null,
  deckId: null,
  deckName: null,
  image: null,
  notes: null,
  updatedAt: "2026-11-25T20:00:00.000Z",
  ...over,
});

beforeEach(() => {
  for (const f of [fetchMe, fetchAuctions, createAuction, updateAuction, deleteAuction, fetchDecks, searchCards, fetchPrintings, addToCollection]) f.mockReset();
  fetchMe.mockResolvedValue(aUser);
  fetchDecks.mockResolvedValue([aDeck({ id: "d1", name: "Deadpool" })]);
  setLocale("en");
  setCurrency({ currency: "USD", rate: 20 });
});
afterEach(() => setLocale("en"));

const rowOf = (name: string) => screen.getByText(name).closest("tr")!;

describe("AuctionsPage", () => {
  it("asks to sign in and loads nothing without a session", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<AuctionsPage />, { path: "/auctions" });
    expect(await screen.findByText("Track your auction bids")).toBeInTheDocument();
    expect(fetchAuctions).not.toHaveBeenCalled();
  });

  it("lists bids by closing time with a countdown, and flags what is losing and what closes soon", async () => {
    fetchAuctions.mockResolvedValue([
      aBid({ id: "b3", cardName: "Lutri", closesAt: inMinutes(24 * 60 + 5), myBid: 25 }),
      aBid({ id: "b4", cardName: "Gray Merchant", status: "won", closesAt: inMinutes(-600), myBid: 40 }),
      aBid({ id: "b2", cardName: "Goblin Bombardment", status: "losing", closesAt: inMinutes(30), myBid: 80, highBid: 100, highBidder: "Luis", maxBid: 95 }),
      aBid({ id: "b1", cardName: "Mirror Gallery", closesAt: inMinutes(45), myBid: 150 }),
    ]);
    renderPage(<AuctionsPage />, { path: "/auctions" });

    await screen.findByText("Lutri");
    const order = screen.getAllByRole("row").slice(1).map((r) => r.querySelector("strong")!.textContent);
    expect(order).toEqual(["Goblin Bombardment", "Mirror Gallery", "Lutri", "Gray Merchant"]);

    const goblin = rowOf("Goblin Bombardment");
    expect(goblin).toHaveClass("is-losing", "is-soon");
    expect(within(goblin).getByText("Losing", { selector: ".badge" })).toBeInTheDocument();
    expect(within(goblin).getByText("Over your max")).toBeInTheDocument();
    expect(within(goblin).getByText("Closes soon")).toBeInTheDocument();
    expect(within(goblin).getByText("Luis")).toBeInTheDocument();
    expect(within(goblin).getByRole("timer").textContent).toMatch(/^00:(29|30):\d\d$/);
    expect(rowOf("Mirror Gallery")).toHaveClass("is-soon");
    expect(rowOf("Mirror Gallery")).not.toHaveClass("is-losing");
    expect(within(rowOf("Lutri")).getByRole("timer").textContent).toMatch(/^1d 00:0[45]:\d\d$/);
    expect(within(rowOf("Gray Merchant")).getByText("Closed")).toBeInTheDocument();
    expect(within(rowOf("Mirror Gallery")).getByRole("link", { name: "Post" })).toHaveAttribute("href", "https://www.facebook.com/groups/1/posts/2");

    // Committed: winning bids (150 + 25) and the won one still unpaid (40).
    expect(screen.getByText("committed if you win what you are winning").previousSibling).toHaveTextContent("MX$215.00");
    expect(screen.getByText("to pay (1 card)").previousSibling).toHaveTextContent("MX$40.00");
    expect(screen.getByText("to pick up (1 card)").previousSibling).toHaveTextContent("MX$40.00");
  });

  it("adds a bid linked to the catalog card picked from the suggestions", async () => {
    fetchAuctions.mockResolvedValue([aBid({ groupName: "Magic CDMX", pickupPlace: "Teatro" })]);
    searchCards.mockResolvedValue([aCard({ oracleId: ORACLE, name: "Goblin Bombardment" })]);
    createAuction.mockResolvedValue(aBid({ id: "new", cardName: "Goblin Bombardment" }));
    renderPage(<AuctionsPage />, { path: "/auctions" });

    await userEvent.click(await screen.findByRole("button", { name: "Add bid" }));
    const form = within(screen.getByRole("form", { name: "New bid" }));
    // A new bid starts with the last bid's group and pick-up place.
    expect(form.getByLabelText("Group")).toHaveValue("Magic CDMX");
    expect(form.getByLabelText("Pick-up place")).toHaveValue("Teatro");
    expect(form.getByText(/Not linked to the catalog/)).toBeInTheDocument();

    await userEvent.type(form.getByLabelText("Card"), "goblin bomb");
    await userEvent.click(await form.findByRole("button", { name: "Goblin Bombardment" }));
    expect(form.getByText(/Linked to the catalog/)).toBeInTheDocument();

    await userEvent.type(form.getByLabelText("My bid (MXN)"), "80");
    await userEvent.type(form.getByLabelText("My max (MXN)"), "95");
    await userEvent.type(form.getByLabelText("Closes at"), "2026-11-25T22:59");
    await userEvent.selectOptions(form.getByLabelText("For deck"), "d1");
    await userEvent.click(form.getByRole("button", { name: "Save bid" }));

    expect(createAuction).toHaveBeenCalledWith(
      expect.objectContaining({
        cardName: "Goblin Bombardment",
        oracleId: ORACLE,
        printingId: null,
        groupName: "Magic CDMX",
        myBid: 80,
        maxBid: 95,
        highBid: null,
        closesAt: new Date("2026-11-25T22:59").toISOString(),
        status: "winning",
        deckId: "d1",
      }),
    );
    expect(screen.queryByRole("form", { name: "New bid" })).not.toBeInTheDocument();
  });

  it("warns when the bid is over the max", async () => {
    fetchAuctions.mockResolvedValue([]);
    renderPage(<AuctionsPage />, { path: "/auctions" });
    await userEvent.click(await screen.findByRole("button", { name: "Add bid" }));
    await userEvent.type(screen.getByLabelText("My bid (MXN)"), "200");
    await userEvent.type(screen.getByLabelText("My max (MXN)"), "190");
    expect(screen.getByText("Your bid is over your max.")).toBeInTheDocument();
  });

  it("offers to add a picked-up card to the collection, with the price in dollars at the user's rate", async () => {
    const bid = aBid({ status: "paid", oracleId: ORACLE, myBid: 200 });
    fetchAuctions.mockResolvedValue([bid]);
    updateAuction.mockResolvedValue({ ...bid, status: "picked_up" });
    fetchPrintings.mockResolvedValue([aPrinting({ id: "p1", finishes: ["nonfoil", "foil"] }), aPrinting({ id: "p2", setCode: "sld", setName: "Secret Lair", finishes: ["foil"] })]);
    addToCollection.mockResolvedValue({});
    renderPage(<AuctionsPage />, { path: "/auctions" });

    await userEvent.selectOptions(await screen.findByLabelText("Status of Mirror Gallery"), "picked_up");
    expect(updateAuction).toHaveBeenCalledWith("b1", { status: "picked_up" });
    const offer = within(await screen.findByRole("region", { name: /You picked up Mirror Gallery/ }));
    expect(offer.getByText(/saved as \$10\.00 at your rate of 20/)).toBeInTheDocument();
    await userEvent.selectOptions(await offer.findByLabelText("Printing"), "p2");
    await userEvent.click(offer.getByRole("button", { name: "Add to collection" }));
    expect(addToCollection).toHaveBeenCalledWith(expect.objectContaining({ printingId: "p2", quantity: 1, finish: "foil", purchasePrice: 10 }));
    expect(await offer.findByText(/Added to your collection/)).toBeInTheDocument();
  });

  it("says a picked-up bid without a catalog card cannot be added from here", async () => {
    const bid = aBid({ status: "paid" });
    fetchAuctions.mockResolvedValue([bid]);
    updateAuction.mockResolvedValue({ ...bid, status: "picked_up" });
    renderPage(<AuctionsPage />, { path: "/auctions" });
    await userEvent.selectOptions(await screen.findByLabelText("Status of Mirror Gallery"), "picked_up");
    expect(await screen.findByText(/not linked to a card in the catalog/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to collection" })).not.toBeInTheDocument();
    expect(fetchPrintings).not.toHaveBeenCalled();
  });

  it("deletes a bid only after confirming", async () => {
    fetchAuctions.mockResolvedValueOnce([aBid()]).mockResolvedValue([]);
    deleteAuction.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPage(<AuctionsPage />, { path: "/auctions" });
    const button = await screen.findByRole("button", { name: "Delete the bid for Mirror Gallery" });
    await userEvent.click(button);
    expect(deleteAuction).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(deleteAuction).toHaveBeenCalledWith("b1", expect.anything());
    expect(await screen.findByText(/No bids yet/)).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("speaks Spanish", async () => {
    setLocale("es");
    fetchAuctions.mockResolvedValue([aBid({ status: "losing", closesAt: inMinutes(20) })]);
    renderPage(<AuctionsPage />, { path: "/auctions" });
    expect(await screen.findByText("Mirror Gallery")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Subastas" })).toBeInTheDocument();
    expect(within(rowOf("Mirror Gallery")).getByText("Perdiendo", { selector: ".badge" })).toBeInTheDocument();
    expect(screen.getByText("Cierra pronto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar puja" })).toBeInTheDocument();
    expect(screen.getByText("comprometido si ganas lo que vas ganando")).toBeInTheDocument();
  });
});
