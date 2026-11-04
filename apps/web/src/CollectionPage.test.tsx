// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, fetchCollection, updateCollectionItem, removeFromCollection } = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  fetchCollection: vi.fn(),
  updateCollectionItem: vi.fn(),
  removeFromCollection: vi.fn(),
}));
vi.mock("./auth", () => ({ fetchMe, logout: vi.fn() }));
vi.mock("./collectionApi", () => ({ fetchCollection, updateCollectionItem, removeFromCollection }));

import { CollectionPage } from "./CollectionPage";
import { aStack, aUser, renderPage } from "./test-utils";

beforeEach(() => {
  for (const f of [fetchMe, fetchCollection, updateCollectionItem, removeFromCollection]) f.mockReset();
  fetchMe.mockResolvedValue(aUser);
});

const rows = () => screen.getAllByRole("listitem");
/** The number shown in the stat card with this label. */
const stat = (label: string) => screen.getByText(label).previousElementSibling;

describe("CollectionPage", () => {
  it("asks to sign in and does not load anything without a session", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<CollectionPage />, { path: "/collection" });
    expect(await screen.findByText(/to see your collection/)).toBeInTheDocument();
    expect(fetchCollection).not.toHaveBeenCalled();
  });

  it("shows an empty collection with a pointer to the search", async () => {
    fetchCollection.mockResolvedValue([]);
    renderPage(<CollectionPage />, { path: "/collection" });
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();
    expect(stat("cards")).toHaveTextContent("0");
    expect(stat("stacks")).toHaveTextContent("0");
  });

  it("lists stacks with set, finish, condition and prices, and totals the market value", async () => {
    fetchCollection.mockResolvedValue([
      aStack({ id: "i1", quantity: 2, unitPrice: 10 }),
      aStack({ id: "i2", name: "Counterspell", finish: "foil", condition: "LP", quantity: 3, unitPrice: null }),
    ]);
    renderPage(<CollectionPage />, { path: "/collection" });

    await screen.findByText("Counterspell");
    expect(stat("cards")).toHaveTextContent("5");
    expect(stat("stacks")).toHaveTextContent("2");
    expect(stat("market value")).toHaveTextContent("$20.00");
    expect(screen.getByText(/3 copies without a price/)).toBeInTheDocument();

    const [bolt, counter] = rows();
    expect(within(bolt!).getByText("Lightning Bolt")).toBeInTheDocument();
    expect(within(bolt!).getByText(/Limited Edition Alpha \(LEA\) #161 · nonfoil · NM/)).toBeInTheDocument();
    expect(within(bolt!).getByText("$10.00 each · $20.00")).toBeInTheDocument();
    expect(within(counter!).getByText(/foil · LP/)).toBeInTheDocument();
    expect(within(counter!).getByText("No price yet")).toBeInTheDocument();
  });

  it("changes the quantity with + and −, and does not let a stack go below 1", async () => {
    fetchCollection.mockResolvedValue([aStack({ id: "i1", quantity: 2 }), aStack({ id: "i2", name: "Island", quantity: 1 })]);
    updateCollectionItem.mockResolvedValue(aStack());
    renderPage(<CollectionPage />, { path: "/collection" });
    await screen.findByText("Island");
    const [bolt, island] = rows();

    expect(within(island!).getByRole("button", { name: "One less" })).toBeDisabled();
    await userEvent.click(within(bolt!).getByRole("button", { name: "One more" }));
    expect(updateCollectionItem).toHaveBeenCalledWith("i1", { quantity: 3 });
    await userEvent.click(within(bolt!).getByRole("button", { name: "One less" }));
    expect(updateCollectionItem).toHaveBeenLastCalledWith("i1", { quantity: 1 });
  });

  it("reloads the list after a change", async () => {
    fetchCollection.mockResolvedValueOnce([aStack({ quantity: 2 })]).mockResolvedValue([aStack({ quantity: 3 })]);
    updateCollectionItem.mockResolvedValue(aStack({ quantity: 3 }));
    renderPage(<CollectionPage />, { path: "/collection" });
    await screen.findByText("Lightning Bolt");
    expect(stat("cards")).toHaveTextContent("2");
    await userEvent.click(screen.getByRole("button", { name: "One more" }));
    await waitFor(() => expect(stat("cards")).toHaveTextContent("3"));
  });

  it("removes a stack", async () => {
    fetchCollection.mockResolvedValueOnce([aStack({ id: "i1" })]).mockResolvedValue([]);
    removeFromCollection.mockResolvedValue(undefined);
    renderPage(<CollectionPage />, { path: "/collection" });
    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));
    expect(removeFromCollection).toHaveBeenCalledWith("i1", expect.anything());
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it("shows why a change was refused", async () => {
    fetchCollection.mockResolvedValue([aStack({ quantity: 4 })]);
    updateCollectionItem.mockRejectedValue(new Error("4 copies are placed in binders; take them out of the binders first"));
    renderPage(<CollectionPage />, { path: "/collection" });
    await userEvent.click(await screen.findByRole("button", { name: "One less" }));
    expect(await screen.findByText(/placed in binders/)).toBeInTheDocument();
  });

  it("shows a load error", async () => {
    fetchCollection.mockRejectedValue(new Error("Request failed (500)"));
    renderPage(<CollectionPage />, { path: "/collection" });
    expect(await screen.findByText("Request failed (500)")).toBeInTheDocument();
  });
});
