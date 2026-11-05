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
const { downloadText } = vi.hoisted(() => ({ downloadText: vi.fn() }));
vi.mock("./download", () => ({ downloadText }));
vi.mock("./collectionApi", () => ({ fetchCollection, updateCollectionItem, removeFromCollection, importCollection: vi.fn() }));

import { CollectionPage } from "./CollectionPage";
import { aStack, aUser, renderPage } from "./test-utils";

beforeEach(() => {
  for (const f of [fetchMe, fetchCollection, updateCollectionItem, removeFromCollection, downloadText]) f.mockReset();
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

  it("lets a card be enlarged from the list", async () => {
    fetchCollection.mockResolvedValue([aStack({ name: "Lightning Bolt" })]);
    renderPage(<CollectionPage />, { path: "/collection" });
    await userEvent.click(await screen.findByRole("button", { name: "Enlarge Lightning Bolt" }));
    expect(screen.getByRole("dialog", { name: "Lightning Bolt" })).toBeInTheDocument();
  });

  it("hides the cached stacks as soon as nobody is signed in", async () => {
    fetchCollection.mockResolvedValue([aStack({ name: "Lightning Bolt" })]);
    const { queryClient } = renderPage(<CollectionPage />, { path: "/collection" });
    expect(await screen.findByText("Lightning Bolt")).toBeInTheDocument();

    queryClient.setQueryData(["me"], null);
    expect(await screen.findByText(/to see your collection/)).toBeInTheDocument();
    expect(screen.queryByText("Lightning Bolt")).not.toBeInTheDocument();
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

  it("shows the new quantity at once, before the server answers", async () => {
    fetchCollection.mockResolvedValue([aStack({ quantity: 2 })]);
    updateCollectionItem.mockReturnValue(new Promise(() => {})); // never answers
    renderPage(<CollectionPage />, { path: "/collection" });
    await screen.findByText("Lightning Bolt");
    await userEvent.click(screen.getByRole("button", { name: "One more" }));
    expect(screen.getByLabelText("Quantity")).toHaveTextContent("3");
    expect(stat("cards")).toHaveTextContent("3");
  });

  it("keeps the buttons usable while saving and sends quick taps one after another", async () => {
    fetchCollection.mockResolvedValue([aStack({ quantity: 2 })]);
    const done: (() => void)[] = [];
    updateCollectionItem.mockImplementation(
      (_id: string, patch: { quantity: number }) => new Promise((resolve) => done.push(() => resolve(aStack({ quantity: patch.quantity })))),
    );
    renderPage(<CollectionPage />, { path: "/collection" });
    await screen.findByText("Lightning Bolt");
    const more = screen.getByRole("button", { name: "One more" });
    await userEvent.click(more);
    await userEvent.click(more);
    await userEvent.click(more);
    expect(more).toBeEnabled();
    expect(screen.getByLabelText("Quantity")).toHaveTextContent("5");

    // Only the first request is in flight; the next one starts when it ends, so they cannot arrive out of order.
    await waitFor(() => expect(updateCollectionItem).toHaveBeenCalledTimes(1));
    expect(updateCollectionItem).toHaveBeenLastCalledWith("i1", { quantity: 3 });
    done[0]!();
    await waitFor(() => expect(updateCollectionItem).toHaveBeenCalledTimes(2));
    expect(updateCollectionItem).toHaveBeenLastCalledWith("i1", { quantity: 4 });
    done[1]!();
    await waitFor(() => expect(updateCollectionItem).toHaveBeenCalledTimes(3));
    expect(updateCollectionItem).toHaveBeenLastCalledWith("i1", { quantity: 5 });
  });

  it("puts the old quantity back when the server refuses the change", async () => {
    fetchCollection.mockResolvedValue([aStack({ quantity: 4 })]);
    updateCollectionItem.mockRejectedValue(new Error("4 copies are placed in binders; take them out of the binders first"));
    renderPage(<CollectionPage />, { path: "/collection" });
    await userEvent.click(await screen.findByRole("button", { name: "One less" }));
    expect(await screen.findByText(/placed in binders/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Quantity")).toHaveTextContent("4"));
  });

  it("exports the collection as a CSV file the import can read back", async () => {
    fetchCollection.mockResolvedValue([aStack({ name: "Lightning Bolt", quantity: 3 })]);
    renderPage(<CollectionPage />, { path: "/collection" });
    await userEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(downloadText).toHaveBeenCalledTimes(1);
    const [name, text, type] = downloadText.mock.calls[0]!;
    expect(name).toMatch(/^mtg-vault-collection-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(type).toBe("text/csv");
    expect(text).toContain("Count,Name,Edition,Condition,Language,Foil,Collector Number,Scryfall ID,Purchase Price");
    expect(text).toContain("3,Lightning Bolt,lea,Near Mint,English,,161,p1,");
    expect(text.startsWith("\ufeff")).toBe(true);
  });

  it("offers no export for an empty collection", async () => {
    fetchCollection.mockResolvedValue([]);
    renderPage(<CollectionPage />, { path: "/collection" });
    await screen.findByText(/Nothing here yet/);
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
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
