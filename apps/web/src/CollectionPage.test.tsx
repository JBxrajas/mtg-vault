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
import { resetCurrency } from "./currency";
import { aStack, aUser, renderPage } from "./test-utils";

beforeEach(() => {
  for (const f of [fetchMe, fetchCollection, updateCollectionItem, removeFromCollection, downloadText]) f.mockReset();
  fetchMe.mockResolvedValue(aUser);
  resetCurrency();
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

    const [counter, bolt] = rows(); // the list is sorted by name
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
    const [island, bolt] = rows(); // the list is sorted by name

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
  describe("search, sorting and filters", () => {
    const stacks = () => [
      aStack({ id: "a", name: "Lightning Bolt", typeLine: "Instant", cmc: 1, colorIdentity: ["R"], rarity: "common", quantity: 4, unitPrice: 2 }),
      aStack({ id: "b", name: "Llanowar Elves", typeLine: "Creature — Elf Druid", cmc: 1, colorIdentity: ["G"], rarity: "common", setCode: "m19", setName: "Core Set 2019", quantity: 1, unitPrice: 0.5 }),
      aStack({ id: "c", name: "Sol Ring", typeLine: "Artifact", cmc: 1, colorIdentity: [], rarity: "uncommon", setCode: "cmm", setName: "Commander Masters", quantity: 1, unitPrice: 30 }),
    ];
    const names = () => rows().map((r) => within(r).getByText(/^(Lightning Bolt|Llanowar Elves|Sol Ring)$/).textContent);

    it("searches by name and says what is shown out of what there is", async () => {
      fetchCollection.mockResolvedValue(stacks());
      renderPage(<CollectionPage />, { path: "/collection" });
      await userEvent.type(await screen.findByLabelText("Search your collection"), "llan");
      expect(names()).toEqual(["Llanowar Elves"]);
      expect(screen.getByText(/Showing 1 of 3 stacks/)).toHaveTextContent("Showing 1 of 3 stacks · 1 card · $0.50");
    });

    it("filters by color, type and rarity, and clears them all", async () => {
      fetchCollection.mockResolvedValue(stacks());
      renderPage(<CollectionPage />, { path: "/collection" });
      await userEvent.click(await screen.findByText("Filters"));
      await userEvent.click(screen.getByRole("button", { name: "Colorless" }));
      expect(names()).toEqual(["Sol Ring"]);
      await userEvent.click(screen.getByRole("button", { name: "Red" }));
      expect(names()).toEqual(["Lightning Bolt", "Sol Ring"]);
      await userEvent.click(screen.getByRole("button", { name: "Uncommon" }));
      expect(names()).toEqual(["Sol Ring"]);
      await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(names()).toHaveLength(3);
      expect(screen.queryByText(/Showing \d+ of/)).not.toBeInTheDocument();
    });

    it("filters by set and by mana value, and says when nothing matches", async () => {
      fetchCollection.mockResolvedValue(stacks());
      renderPage(<CollectionPage />, { path: "/collection" });
      await userEvent.click(await screen.findByText("Filters"));
      await userEvent.selectOptions(screen.getByLabelText("Set"), "m19");
      expect(names()).toEqual(["Llanowar Elves"]);
      await userEvent.type(screen.getByLabelText("Mana value from"), "3");
      expect(await screen.findByText(/No card in your collection matches/)).toBeInTheDocument();
    });

    it("sorts by total value, highest first", async () => {
      fetchCollection.mockResolvedValue(stacks());
      renderPage(<CollectionPage />, { path: "/collection" });
      await userEvent.selectOptions(await screen.findByLabelText("Sort by"), "value");
      await userEvent.click(screen.getByRole("button", { name: "Descending" }));
      expect(names()).toEqual(["Sol Ring", "Lightning Bolt", "Llanowar Elves"]); // 30, 4 × 2 = 8, 0.5
    });

    it("has no search or filters for an empty collection", async () => {
      fetchCollection.mockResolvedValue([]);
      renderPage(<CollectionPage />, { path: "/collection" });
      await screen.findByText(/Nothing here yet/);
      expect(screen.queryByLabelText("Search your collection")).not.toBeInTheDocument();
    });
  });
  describe("prices in Mexican pesos", () => {
    it("converts every amount with the rate the user sets, and keeps the choice", async () => {
      fetchCollection.mockResolvedValue([aStack({ id: "i1", quantity: 2, unitPrice: 10 })]);
      renderPage(<CollectionPage />, { path: "/collection" });
      expect(await screen.findByText("$10.00 each · $20.00")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Mexican pesos" }));
      expect(await screen.findByText("MX$180.00 each · MX$360.00")).toBeInTheDocument(); // the default rate, 18
      expect(stat("market value")).toHaveTextContent("MX$360.00");

      const rate = screen.getByRole("spinbutton", { name: /1 USD =/ });
      await userEvent.clear(rate);
      await userEvent.type(rate, "17.5");
      expect(await screen.findByText("MX$175.00 each · MX$350.00")).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem("mtg-vault.currency")!)).toEqual({ currency: "MXN", rate: 17.5 });
    });

    it("keeps the last valid rate and says so when the typed one is not usable", async () => {
      fetchCollection.mockResolvedValue([aStack({ id: "i1", quantity: 1, unitPrice: 10 })]);
      renderPage(<CollectionPage />, { path: "/collection" });
      await userEvent.click(await screen.findByRole("button", { name: "Mexican pesos" }));
      const rate = screen.getByRole("spinbutton", { name: /1 USD =/ });
      await userEvent.clear(rate);
      await userEvent.type(rate, "0");
      expect(screen.getByText(/Use a rate between/)).toBeInTheDocument();
      expect(screen.getByText("MX$180.00 each · MX$180.00")).toBeInTheDocument(); // still the last valid rate
    });
  });
  describe("high-resolution art", () => {
    const PRINTING = "bba5ea18-4e58-42a8-b613-2178706476a6";

    it("links each stack to its art page, opening in a new window", async () => {
      fetchCollection.mockResolvedValue([aStack({ id: "i1", printingId: PRINTING })]);
      renderPage(<CollectionPage />, { path: "/collection" });
      const link = await screen.findByRole("link", { name: "Lightning Bolt: high-resolution art (opens in a new window)" });
      expect(link).toHaveAttribute("href", `#/art/${PRINTING}`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("has an art view: a gallery of the art of what the filters leave, each linking to its art page", async () => {
      fetchCollection.mockResolvedValue([
        aStack({ id: "i1", printingId: PRINTING, name: "Lightning Bolt" }),
        aStack({ id: "i2", printingId: "11111111-1111-4111-8111-111111111111", name: "Counterspell", colorIdentity: ["U"] }),
      ]);
      renderPage(<CollectionPage />, { path: "/collection" });
      await userEvent.click(await screen.findByRole("button", { name: "Art" }));
      const gallery = document.querySelector(".art-gallery")!;
      expect(within(gallery as HTMLElement).getAllByRole("link")).toHaveLength(2);
      expect(within(gallery as HTMLElement).getByRole("link", { name: /Lightning Bolt/ })).toHaveAttribute("href", `#/art/${PRINTING}`);

      await userEvent.type(screen.getByLabelText("Search your collection"), "counter");
      expect(within(gallery as HTMLElement).getAllByRole("link")).toHaveLength(1);
    });
  });
});
