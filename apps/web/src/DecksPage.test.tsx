// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, fetchDecks, createDeck } = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  fetchDecks: vi.fn(),
  createDeck: vi.fn(),
}));
vi.mock("./auth", () => ({ fetchMe }));
vi.mock("./decksApi", () => ({ fetchDecks, createDeck }));

import { DecksPage } from "./DecksPage";
import { aDeck, aUser, renderPage } from "./test-utils";

beforeEach(() => {
  for (const f of [fetchMe, fetchDecks, createDeck]) f.mockReset();
  fetchMe.mockResolvedValue(aUser);
});

describe("DecksPage", () => {
  it("asks to sign in and loads nothing without a session", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<DecksPage />, { path: "/decks" });
    expect(await screen.findByText(/to build decks/)).toBeInTheDocument();
    expect(fetchDecks).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Deck name")).not.toBeInTheDocument();
  });

  it("invites to create the first deck", async () => {
    fetchDecks.mockResolvedValue([]);
    renderPage(<DecksPage />, { path: "/decks" });
    expect(await screen.findByText(/No decks yet/)).toBeInTheDocument();
  });

  it("lists decks with format and progress towards the format's size", async () => {
    fetchDecks.mockResolvedValue([
      aDeck({ id: "d1", name: "Mono red", format: "modern", cardCount: 58 }),
      aDeck({ id: "d2", name: "Elves", format: "commander", cardCount: 99 }),
      aDeck({ id: "d3", name: "Pile", format: "casual", cardCount: 12 }),
    ]);
    renderPage(<DecksPage />, { path: "/decks" });

    const mono = (await screen.findByRole("link", { name: /Mono red/ })) as HTMLAnchorElement;
    expect(mono).toHaveAttribute("href", "/decks/d1");
    expect(within(mono).getByText("Modern")).toBeInTheDocument();
    expect(within(mono).getByText("58 / 60 cards")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Elves/ })).getByText("99 / 100 cards")).toBeInTheDocument();
    // Casual has no target size.
    expect(within(screen.getByRole("link", { name: /Pile/ })).getByText("12 cards")).toBeInTheDocument();
  });

  it("does not create a deck without a name", async () => {
    fetchDecks.mockResolvedValue([]);
    renderPage(<DecksPage />, { path: "/decks" });
    expect(await screen.findByRole("button", { name: "Create deck" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Deck name"), "   ");
    expect(screen.getByRole("button", { name: "Create deck" })).toBeDisabled();
  });

  it("creates a deck with the chosen format and opens it", async () => {
    fetchDecks.mockResolvedValue([]);
    createDeck.mockResolvedValue(aDeck({ id: "new1", name: "Elves", format: "commander" }));
    renderPage(<DecksPage />, { path: "/decks" });

    await userEvent.type(await screen.findByLabelText("Deck name"), "Elves");
    await userEvent.selectOptions(screen.getByLabelText("Format"), "commander");
    await userEvent.click(screen.getByRole("button", { name: "Create deck" }));

    expect(createDeck).toHaveBeenCalledWith({ name: "Elves", format: "commander" });
    expect(await screen.findByText("route: /decks/$deckId")).toBeInTheDocument();
  });

  it("shows why a deck could not be created", async () => {
    fetchDecks.mockResolvedValue([]);
    createDeck.mockRejectedValue(new Error("Request failed (500)"));
    renderPage(<DecksPage />, { path: "/decks" });
    await userEvent.type(await screen.findByLabelText("Deck name"), "Elves");
    await userEvent.click(screen.getByRole("button", { name: "Create deck" }));
    expect(await screen.findByText("Request failed (500)")).toBeInTheDocument();
  });

  it("shows a load error", async () => {
    fetchDecks.mockRejectedValue(new Error("Request failed (500)"));
    renderPage(<DecksPage />, { path: "/decks" });
    expect(await screen.findByText("Request failed (500)")).toBeInTheDocument();
  });
});
