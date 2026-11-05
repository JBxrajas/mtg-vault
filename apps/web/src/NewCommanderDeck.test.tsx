// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createDeck, addDeckCard, importDeck, searchCards, fetchPrintings } = vi.hoisted(() => ({
  createDeck: vi.fn(),
  addDeckCard: vi.fn(),
  importDeck: vi.fn(),
  searchCards: vi.fn(),
  fetchPrintings: vi.fn(),
}));
vi.mock("./decksApi", () => ({ createDeck, addDeckCard, importDeck }));
vi.mock("./api", () => ({ searchCards, fetchPrintings }));

import { NewCommanderDeck } from "./NewCommanderDeck";
import { aCard, aDeck, aPrinting, renderPage } from "./test-utils";

const render = () => renderPage(<NewCommanderDeck />, { path: "/decks" });

const iroh = aCard({ oracleId: "iroh", name: "Iroh, Grand Lotus", typeLine: "Legendary Creature — Human Noble Ally", colorIdentity: ["U", "R", "G"] });

beforeEach(() => {
  for (const f of [createDeck, addDeckCard, importDeck, searchCards, fetchPrintings]) f.mockReset();
  createDeck.mockResolvedValue(aDeck({ id: "d9", name: "Tea time", format: "commander" }));
  addDeckCard.mockResolvedValue({});
  importDeck.mockResolvedValue({ created: 2, updated: 0, unchanged: 0, problems: [] });
  searchCards.mockResolvedValue([iroh]);
  fetchPrintings.mockResolvedValue([aPrinting({ id: "p-new" }), aPrinting({ id: "p-old", setCode: "cmm", setName: "Commander Masters", collectorNumber: "7" })]);
});

const toCommanderStep = async (name = "Tea time") => {
  await userEvent.click(await screen.findByText("New Commander deck (guided)"));
  await userEvent.type(screen.getByLabelText("Name your new deck"), name);
  await userEvent.click(screen.getByRole("button", { name: "Next: choose the commander" }));
};

const pickIroh = async () => {
  await userEvent.type(await screen.findByLabelText("Search for your commander"), "iroh");
  await userEvent.click(await screen.findByRole("button", { name: /Iroh, Grand Lotus/ }));
  await userEvent.click(await screen.findByRole("button", { name: /Commander Masters \(CMM\) #7/ }));
  await userEvent.click(screen.getByRole("button", { name: "Use Iroh, Grand Lotus as commander" }));
};

describe("NewCommanderDeck", () => {
  it("starts with the name, and cannot go on without one", async () => {
    render();
    await userEvent.click(await screen.findByText("New Commander deck (guided)"));
    expect(screen.getByRole("button", { name: "Next: choose the commander" })).toBeDisabled();
    expect(screen.getByText("Name").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("shows the commander large with the art that was picked, then creates the deck with the 99 and no second copy of the commander", async () => {
    render();
    await toCommanderStep();
    await pickIroh();

    const card = await screen.findByRole("region", { name: "Your commander" });
    expect(within(card).getByAltText("Iroh, Grand Lotus")).toBeInTheDocument();
    expect(within(card).getByText("Temur")).toBeInTheDocument();
    expect(screen.getByText("The 99").closest("li")).toHaveAttribute("aria-current", "step");

    await userEvent.click(screen.getByLabelText("Deck list", { exact: true }));
    await userEvent.paste("Commander\n1 Iroh, Grand Lotus\n\nDeck\n1 Sol Ring\n1 Cultivate");
    expect(await screen.findByText("2 of 99 cards read.")).toBeInTheDocument();
    expect(screen.getByText(/1 copy of your commander in the list is left out/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create the deck" }));
    expect(await screen.findByText("route: /decks/$deckId")).toBeInTheDocument();
    expect(createDeck).toHaveBeenCalledWith({ name: "Tea time", format: "commander" });
    expect(addDeckCard).toHaveBeenCalledWith("d9", { oracleId: "iroh", board: "commander", quantity: 1, printingId: "p-old" });
    expect(importDeck.mock.calls[0]![1].map((r: { name: string }) => r.name)).toEqual(["Sol Ring", "Cultivate"]);
  });

  it("can leave the cards for later: only the commander is added", async () => {
    render();
    await toCommanderStep();
    await pickIroh();
    await userEvent.click(await screen.findByRole("button", { name: "I'll choose them later" }));
    await userEvent.click(screen.getByRole("button", { name: "Create the deck" }));
    expect(await screen.findByText("route: /decks/$deckId")).toBeInTheDocument();
    expect(addDeckCard).toHaveBeenCalledTimes(1);
    expect(importDeck).not.toHaveBeenCalled();
  });

  it("stays to show the cards that could not be imported, with a link to the deck", async () => {
    importDeck.mockResolvedValue({ created: 1, updated: 0, unchanged: 0, problems: [{ line: 2, name: "Sol Rign", reason: "No card with this name" }] });
    render();
    await toCommanderStep();
    await pickIroh();
    await userEvent.click(await screen.findByLabelText("Deck list", { exact: true }));
    await userEvent.paste("1 Sol Rign");
    await userEvent.click(screen.getByRole("button", { name: "Create the deck" }));
    expect((await screen.findAllByText(/Sol Rign/)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/No card with this name/)).toBeInTheDocument();
    expect(screen.queryByText("route: /decks/$deckId")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the deck/ })).toBeInTheDocument();
  });

  it("lets the player go back to change the commander", async () => {
    render();
    await toCommanderStep();
    await pickIroh();
    await userEvent.click(await screen.findByRole("button", { name: "Change commander" }));
    expect(await screen.findByLabelText("Search for your commander")).toBeInTheDocument();
    await waitFor(() => expect(createDeck).not.toHaveBeenCalled());
  });
});
