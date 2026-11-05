// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, fetchDeck, setDeckCard, addDeckCard, updateDeck, deleteDeck, searchCards, fetchPrintings, importDeck } = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  fetchDeck: vi.fn(),
  setDeckCard: vi.fn(),
  addDeckCard: vi.fn(),
  updateDeck: vi.fn(),
  deleteDeck: vi.fn(),
  searchCards: vi.fn(),
  fetchPrintings: vi.fn(),
  importDeck: vi.fn(),
}));
vi.mock("./auth", () => ({ fetchMe }));
vi.mock("./decksApi", () => ({ fetchDeck, setDeckCard, addDeckCard, updateDeck, deleteDeck, importDeck }));
vi.mock("./api", () => ({ searchCards, fetchPrintings }));

import { DeckPage, ownedBadge } from "./DeckPage";
import { t } from "./i18n";
import { aCard, aDeck, aDeckCard, aPrinting, aUser, renderPage } from "./test-utils";

const render = () => renderPage(<DeckPage />, { path: "/decks/d1", route: "/decks/$deckId" });

const detail = (cards = [aDeckCard()], deck = aDeck()) => ({ deck, cards });

beforeEach(() => {
  for (const f of [fetchMe, fetchDeck, setDeckCard, addDeckCard, updateDeck, deleteDeck, searchCards, fetchPrintings, importDeck]) f.mockReset();
  fetchMe.mockResolvedValue(aUser);
});

describe("ownedBadge", () => {
  it("says Owned when the collection covers the deck, else how many of how many", () => {
    expect(ownedBadge({ owned: 4, quantity: 4 }, t)).toEqual({ text: "Owned", enough: true });
    expect(ownedBadge({ owned: 9, quantity: 4 }, t)).toEqual({ text: "Owned", enough: true });
    expect(ownedBadge({ owned: 1, quantity: 4 }, t)).toEqual({ text: "Own 1/4", enough: false });
    expect(ownedBadge({ owned: 0, quantity: 1 }, t)).toEqual({ text: "Own 0/1", enough: false });
  });
});

describe("DeckPage", () => {
  it("asks to sign in without a session", async () => {
    fetchMe.mockResolvedValue(null);
    render();
    expect(await screen.findByText(/to see this deck/)).toBeInTheDocument();
    expect(fetchDeck).not.toHaveBeenCalled();
  });

  it("shows the server's message when the deck cannot be loaded", async () => {
    fetchDeck.mockRejectedValue(new Error("Deck not found"));
    render();
    expect(await screen.findByText("Deck not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my decks" })).toBeInTheDocument();
  });

  it("divides the main board by card type, in display order, with counts per group", async () => {
    fetchDeck.mockResolvedValue(
      detail([
        aDeckCard({ oracleId: "land", name: "Mountain", typeLine: "Basic Land — Mountain", quantity: 20, manaCost: null }),
        aDeckCard({ oracleId: "bolt", name: "Lightning Bolt", typeLine: "Instant", quantity: 4 }),
        aDeckCard({ oracleId: "goblin", name: "Goblin Guide", typeLine: "Creature — Goblin Scout", quantity: 4 }),
        aDeckCard({ oracleId: "wall", name: "Wall of Omens", typeLine: "Artifact Creature — Wall", quantity: 2 }),
        aDeckCard({ oracleId: "sol", name: "Sol Ring", typeLine: "Artifact", quantity: 1 }),
        aDeckCard({ oracleId: "side", name: "Smash to Smithereens", typeLine: "Instant", quantity: 3, board: "sideboard" }),
      ]),
    );
    render();
    await screen.findByText("Goblin Guide");

    const titles = screen.getAllByRole("heading", { level: 2 }).filter((h) => !h.closest(".analysis")).map((h) => h.textContent);
    expect(titles).toEqual(["Creature (6)", "Instant (4)", "Artifact (1)", "Land (20)"]);
    // An Artifact Creature is a Creature.
    expect(within(screen.getByRole("region", { name: "Creature" })).getByText("Wall of Omens")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Artifact" })).queryByText("Wall of Omens")).not.toBeInTheDocument();
    // The sideboard is not in the main board's groups.
    expect(screen.queryByText("Smash to Smithereens")).not.toBeInTheDocument();
  });

  it("shows the deck size against the format's target and flags going over it", async () => {
    fetchDeck.mockResolvedValue(detail([aDeckCard({ quantity: 58 })], aDeck({ format: "modern" })));
    const { unmount } = render();
    expect(await screen.findByText("58 / 60 cards")).not.toHaveClass("over");
    unmount();

    fetchDeck.mockResolvedValue(detail([aDeckCard({ quantity: 61 })], aDeck({ format: "modern" })));
    render();
    expect(await screen.findByText("61 / 60 cards")).toHaveClass("over");
  });

  it("shows a bar of how the cards divide among types, and how many cards have warnings", async () => {
    fetchDeck.mockResolvedValue(
      detail(
        [
          aDeckCard({ oracleId: "c", name: "Iroh", board: "commander", quantity: 1, typeLine: "Legendary Creature", colorIdentity: ["U"] }),
          aDeckCard({ oracleId: "a", name: "Bear", typeLine: "Creature — Bear", quantity: 3 }),
          aDeckCard({ oracleId: "b", name: "Bolt", typeLine: "Instant", quantity: 2 }),
        ],
        aDeck({ format: "commander" }),
      ),
    );
    render();
    const legend = await screen.findByRole("list", { name: "Cards by type" });
    expect(within(legend).getByText("Creature").closest("li")).toHaveTextContent("Creature 3");
    expect(within(legend).getByText("Instant").closest("li")).toHaveTextContent("Instant 2");
    expect(screen.getByRole("progressbar", { name: "Deck size" })).toHaveAttribute("aria-valuenow", "6");
    // Iroh has colors the other cards do not follow, so some cards carry a warning and the header counts them.
    expect(screen.getByText(/to check/)).toBeInTheDocument();
  });

  it("puts the commander board first and counts it towards the size", async () => {
    fetchDeck.mockResolvedValue(
      detail(
        [
          aDeckCard({ oracleId: "cmd", name: "Atraxa", typeLine: "Legendary Creature — Phyrexian", board: "commander", quantity: 1 }),
          aDeckCard({ oracleId: "c1", name: "Llanowar Elves", typeLine: "Creature — Elf Druid", quantity: 1 }),
        ],
        aDeck({ format: "commander" }),
      ),
    );
    render();
    await screen.findAllByText("Atraxa");
    expect(screen.getAllByRole("heading", { level: 2 }).filter((h) => !h.closest(".analysis")).map((h) => h.textContent)).toEqual(["Commander (1)", "Creature (1)"]);
    expect(screen.getByText("2 / 100 cards")).toBeInTheDocument();
  });

  it("shows how many of each card the collection covers", async () => {
    fetchDeck.mockResolvedValue(
      detail([
        aDeckCard({ oracleId: "a", name: "Lightning Bolt", quantity: 4, owned: 4 }),
        aDeckCard({ oracleId: "b", name: "Goblin Guide", typeLine: "Creature", quantity: 4, owned: 1 }),
      ]),
    );
    render();
    await screen.findByText("Goblin Guide");
    expect(screen.getByText("Owned")).toHaveClass("yes");
    expect(screen.getByText("Own 1/4")).toHaveClass("no");
  });

  it("changes a quantity and shows the deck the server answers with", async () => {
    fetchDeck.mockResolvedValue(detail([aDeckCard({ quantity: 4 })]));
    setDeckCard.mockResolvedValue(detail([aDeckCard({ quantity: 5 })]));
    render();
    await screen.findByText("Lightning Bolt");

    await userEvent.click(screen.getByRole("button", { name: "One more Lightning Bolt" }));
    expect(setDeckCard).toHaveBeenCalledWith("d1", { oracleId: "o-bolt", board: "main", quantity: 5 });
    await waitFor(() => expect(screen.getByLabelText("Lightning Bolt quantity")).toHaveTextContent("5"));
  });

  it("removes a card with − from one copy and with Remove", async () => {
    fetchDeck.mockResolvedValue(detail([aDeckCard({ quantity: 1 })]));
    setDeckCard.mockResolvedValue(detail([]));
    render();
    await userEvent.click(await screen.findByRole("button", { name: "One less Lightning Bolt" }));
    expect(setDeckCard).toHaveBeenLastCalledWith("d1", { oracleId: "o-bolt", board: "main", quantity: 0 });
    expect(await screen.findByText(/This deck is empty/)).toBeInTheDocument();

    fetchDeck.mockResolvedValue(detail([aDeckCard({ quantity: 3 })]));
    render();
    await userEvent.click((await screen.findAllByRole("button", { name: "Remove Lightning Bolt" })).at(-1)!);
    expect(setDeckCard).toHaveBeenLastCalledWith("d1", { oracleId: "o-bolt", board: "main", quantity: 0 });
  });

  it("shows why a change was refused", async () => {
    fetchDeck.mockResolvedValue(detail());
    setDeckCard.mockRejectedValue(new Error("That card is not on this board; add it first"));
    render();
    await userEvent.click(await screen.findByRole("button", { name: "One more Lightning Bolt" }));
    expect(await screen.findByText(/not on this board/)).toBeInTheDocument();
  });

  it("lists the sideboard and the maybeboard on their own tabs", async () => {
    fetchDeck.mockResolvedValue(
      detail([
        aDeckCard({ oracleId: "m", name: "Lightning Bolt", quantity: 4 }),
        aDeckCard({ oracleId: "s1", name: "Smash to Smithereens", board: "sideboard", quantity: 2 }),
        aDeckCard({ oracleId: "s2", name: "Blood Moon", board: "sideboard", quantity: 3 }),
      ]),
    );
    render();
    await screen.findByText("Lightning Bolt");

    const sideTab = screen.getByRole("button", { name: "Sideboard (5)" });
    await userEvent.click(sideTab);
    expect(sideTab).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Smash to Smithereens")).toBeInTheDocument();
    expect(screen.getByText("Blood Moon")).toBeInTheDocument();
    expect(screen.queryByText("Lightning Bolt")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Maybeboard (0)" }));
    expect(screen.getByText(/Nothing in the maybeboard yet/)).toBeInTheDocument();
  });

  it("searches cards and adds one to the chosen board", async () => {
    fetchDeck.mockResolvedValue(detail([], aDeck({ format: "commander" })));
    searchCards.mockResolvedValue([aCard({ oracleId: "o-sol", name: "Sol Ring", manaCost: "{1}", typeLine: "Artifact" })]);
    addDeckCard.mockResolvedValue(
      detail([aDeckCard({ oracleId: "o-sol", name: "Sol Ring", typeLine: "Artifact", board: "commander", quantity: 1 })], aDeck({ format: "commander" })),
    );
    render();

    await userEvent.type(await screen.findByLabelText("Search a card to add"), "sol");
    const addBtn = await screen.findByRole("button", { name: "Add Sol Ring" });
    expect(searchCards.mock.calls.at(-1)![0]).toMatchObject({ q: "sol", limit: 8 });

    await userEvent.selectOptions(screen.getByLabelText("Add to board"), "commander");
    await userEvent.click(addBtn);
    expect(addDeckCard).toHaveBeenCalledWith("d1", { oracleId: "o-sol", board: "commander", quantity: 1 });
    expect(await screen.findByRole("region", { name: "Commander" })).toBeInTheDocument();
  });

  it("offers the commander board only to commander-style formats", async () => {
    fetchDeck.mockResolvedValue(detail([], aDeck({ format: "modern" })));
    render();
    const select = await screen.findByLabelText("Add to board");
    expect([...(select as HTMLSelectElement).options].map((o) => o.value)).toEqual(["main", "sideboard", "maybeboard"]);
  });

  it("does not search for fewer than 2 characters", async () => {
    fetchDeck.mockResolvedValue(detail());
    render();
    await userEvent.type(await screen.findByLabelText("Search a card to add"), "s");
    await new Promise((r) => setTimeout(r, 450));
    expect(searchCards).not.toHaveBeenCalled();
  });

  it("saves new settings", async () => {
    fetchDeck.mockResolvedValue(detail());
    updateDeck.mockResolvedValue(aDeck({ name: "Burn", format: "pioneer", isPublic: true }));
    render();
    await userEvent.click(await screen.findByText("Deck settings"));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Burn");
    await userEvent.selectOptions(screen.getByLabelText("Format"), "pioneer");
    await userEvent.click(screen.getByLabelText("Public deck"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateDeck).toHaveBeenCalledWith("d1", { name: "Burn", format: "pioneer", isPublic: true });
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("deletes the deck only after confirming, then goes back to the list", async () => {
    fetchDeck.mockResolvedValue(detail());
    deleteDeck.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm");
    render();
    await userEvent.click(await screen.findByText("Deck settings"));

    confirm.mockReturnValueOnce(false);
    await userEvent.click(screen.getByRole("button", { name: "Delete deck" }));
    expect(deleteDeck).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await userEvent.click(screen.getByRole("button", { name: "Delete deck" }));
    expect(deleteDeck).toHaveBeenCalledWith("d1");
    expect(await screen.findByText("route: /decks")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("keeps the boards help bubble outside the scrolling tab row, where it would be clipped", async () => {
    fetchDeck.mockResolvedValue(detail());
    render();
    const tabs = await screen.findByRole("group", { name: "Boards" });
    expect(within(tabs).queryByRole("button", { name: /Help/ })).not.toBeInTheDocument();
    expect(within(tabs).getAllByRole("button")).toHaveLength(3);
    const help = screen.getByRole("button", { name: "Help: boards" });
    expect(tabs.parentElement).toBe(help.closest(".tab" + "s-row"));
    await userEvent.click(help);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(tabs).not.toContainElement(screen.getByRole("tooltip"));
  });

  it("shows the Commander analysis only for Commander decks", async () => {
    fetchDeck.mockResolvedValue(detail([aDeckCard({ name: "Sol Ring", board: "commander" })], aDeck({ format: "commander" })));
    const first = render();
    expect(await screen.findByRole("region", { name: "Commander analysis" })).toBeInTheDocument();
    first.unmount();

    fetchDeck.mockResolvedValue(detail([aDeckCard()], aDeck({ format: "modern" })));
    render();
    await screen.findByText("Lightning Bolt");
    expect(screen.queryByRole("region", { name: "Commander analysis" })).not.toBeInTheDocument();
  });
  it("keeps the commander in a bar above the board tabs", async () => {
    fetchDeck.mockResolvedValue(
      detail([aDeckCard({ oracleId: "c1", name: "Atraxa", board: "commander", quantity: 1, colorIdentity: ["W", "U"] })], aDeck({ format: "commander" })),
    );
    render();
    const bar = await screen.findByRole("region", { name: "Deck commander" });
    expect(within(bar).getByText("Atraxa")).toBeInTheDocument();
    expect(within(bar).getByText("Azorius")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Sideboard/ }));
    expect(screen.getByRole("region", { name: "Deck commander" })).toBeInTheDocument();
  });

  describe("choosing the commander first", () => {
    const iroh = aCard({ oracleId: "iroh", name: "Iroh, Grand Lotus", typeLine: "Legendary Creature — Human Noble Ally", colorIdentity: ["U", "R", "G"] });
    const urza = aCard({ oracleId: "urza", name: "Urza's Saga", typeLine: "Legendary Enchantment Land" });

    beforeEach(() => {
      fetchDeck.mockResolvedValue(detail([aDeckCard()], aDeck({ format: "commander" })));
      searchCards.mockResolvedValue([iroh, urza]);
      fetchPrintings.mockResolvedValue([aPrinting({ id: "p-new" }), aPrinting({ id: "p-old", setCode: "cmm", setName: "Commander Masters", collectorNumber: "7" })]);
      addDeckCard.mockResolvedValue(detail([aDeckCard({ oracleId: "iroh", name: "Iroh, Grand Lotus", board: "commander", quantity: 1 })], aDeck({ format: "commander" })));
    });

    it("asks for the commander before anything else, and holds the list import until there is one", async () => {
      render();
      const step = await screen.findByRole("region", { name: "Deck commander" });
      expect(within(step).getByText("Step 1 · Choose your commander")).toBeInTheDocument();
      await userEvent.click(screen.getByText("Import / export list"));
      expect(screen.getByText(/Choose the commander first/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Deck list", { exact: true })).not.toBeInTheDocument();
    });

    it("refuses cards that cannot lead, and saves the chosen printing with the commander", async () => {
      render();
      await userEvent.type(await screen.findByLabelText("Search for your commander"), "iroh");
      const refused = await screen.findByRole("button", { name: /Urza's Saga/ });
      expect(refused).toBeDisabled();
      expect(within(refused).getByText("Legendary, but not a creature")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Iroh, Grand Lotus/ }));
      expect(await screen.findByText("Temur")).toBeInTheDocument();
      await userEvent.click(await screen.findByRole("button", { name: /Commander Masters \(CMM\) #7/ }));
      await userEvent.click(screen.getByRole("button", { name: "Use Iroh, Grand Lotus as commander" }));

      await waitFor(() => expect(addDeckCard).toHaveBeenCalledWith("d1", { oracleId: "iroh", board: "commander", quantity: 1, printingId: "p-old" }));
    });
  });

  it("leaves the commander out of a pasted list, since the deck already has it", async () => {
    fetchDeck.mockResolvedValue(
      detail([aDeckCard({ oracleId: "c1", name: "Atraxa", board: "commander", quantity: 1 }), aDeckCard({ oracleId: "m1", name: "Sol Ring", board: "main", quantity: 1 })], aDeck({ format: "commander" })),
    );
    importDeck.mockResolvedValue({ created: 1, updated: 0, unchanged: 0, problems: [] });
    render();
    await userEvent.click(await screen.findByText("Import / export list"));
    await userEvent.click(screen.getByLabelText("Deck list", { exact: true }));
    await userEvent.paste("Commander\n1 Atraxa\n\nDeck\n1 Arcane Signet\n1 atraxa");
    expect(await screen.findByText(/2 copies of your commander in the list are left out/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Import 1 card/ }));
    await waitFor(() => expect(importDeck).toHaveBeenCalled());
    expect(importDeck.mock.calls[0]![1].map((r: { name: string }) => r.name)).toEqual(["Arcane Signet"]);
  });

  it("highlights the cards with a problem and says what it is", async () => {
    fetchDeck.mockResolvedValue(
      detail(
        [
          aDeckCard({ oracleId: "c1", name: "Iroh", typeLine: "Legendary Creature — Human", board: "commander", quantity: 1, colorIdentity: ["G"] }),
          aDeckCard({ oracleId: "b1", name: "Lightning Bolt", typeLine: "Instant", quantity: 1, colorIdentity: ["R"] }),
          aDeckCard({ oracleId: "e1", name: "Llanowar Elves", typeLine: "Creature — Elf", quantity: 1, colorIdentity: ["G"] }),
        ],
        aDeck({ format: "commander" }),
      ),
    );
    render();
    const bolt = (await screen.findAllByText("Lightning Bolt")).map((n) => n.closest("li")).find(Boolean)!;
    expect(bolt).toHaveClass("has-problem");
    expect(within(bolt).getByText(/Outside the commander's colors \(Red\)/)).toBeInTheDocument();
    expect(screen.getByText("Llanowar Elves").closest("li")).not.toHaveClass("has-problem");
  });

  it("folds and unfolds each group, and all of them at once", async () => {
    fetchDeck.mockResolvedValue(
      detail(
        [aDeckCard({ oracleId: "bolt", name: "Lightning Bolt", typeLine: "Instant" }), aDeckCard({ oracleId: "elf", name: "Llanowar Elves", typeLine: "Creature — Elf" })],
        aDeck({ format: "modern" }),
      ),
    );
    render();
    const creature = await screen.findByRole("button", { name: /Creature/ });
    expect(creature).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(creature);
    expect(creature).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Llanowar Elves")).not.toBeVisible();
    expect(screen.getByText("Lightning Bolt")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText("Lightning Bolt")).not.toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("Lightning Bolt")).toBeVisible();
  });

  it("has no commander bar in other formats", async () => {
    fetchDeck.mockResolvedValue(detail([aDeckCard()], aDeck({ format: "modern" })));
    render();
    await screen.findByText("Lightning Bolt");
    expect(screen.queryByRole("region", { name: "Deck commander" })).not.toBeInTheDocument();
  });
});
