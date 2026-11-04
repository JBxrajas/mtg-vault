// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createDeck, importDeck } = vi.hoisted(() => ({ createDeck: vi.fn(), importDeck: vi.fn() }));
vi.mock("./decksApi", () => ({ createDeck, importDeck }));

import { ImportDeck } from "./ImportDeck";
import { aDeck, renderPage } from "./test-utils";

const render = () => renderPage(<ImportDeck />, { path: "/decks" });

beforeEach(() => {
  createDeck.mockReset();
  importDeck.mockReset();
  createDeck.mockResolvedValue(aDeck({ id: "d9", name: "Imported", format: "commander" }));
});

const fill = async (name: string, list: string) => {
  await userEvent.click(await screen.findByText("Import a deck"));
  if (name) await userEvent.type(screen.getByLabelText("Name of the imported deck"), name);
  await userEvent.click(screen.getByLabelText("Deck list"));
  await userEvent.paste(list);
};

describe("ImportDeck", () => {
  it("creates the deck with the chosen name and format, imports the list and opens the deck", async () => {
    importDeck.mockResolvedValue({ created: 2, updated: 0, unchanged: 0, problems: [] });
    render();
    await fill("Imported", "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring");
    await userEvent.selectOptions(screen.getByLabelText("Format of the imported deck"), "commander");
    await userEvent.click(screen.getByRole("button", { name: "Create deck from list" }));

    expect(createDeck).toHaveBeenCalledWith({ name: "Imported", format: "commander" });
    expect(importDeck).toHaveBeenCalledWith(
      "d9",
      [
        { line: 2, name: "Atraxa, Praetors' Voice", quantity: 1, board: "commander" },
        { line: 5, name: "Sol Ring", quantity: 1, board: "main" },
      ],
      expect.any(Function),
    );
    expect(await screen.findByText("route: /decks/$deckId")).toBeInTheDocument();
  });

  it("stays on the page with the report when some cards were not found", async () => {
    importDeck.mockResolvedValue({ created: 1, updated: 0, unchanged: 0, problems: [{ line: 2, name: "Sol Rng", reason: "No card found" }] });
    render();
    await fill("Imported", "1 Sol Ring\n1 Sol Rng");
    await userEvent.click(screen.getByRole("button", { name: "Create deck from list" }));
    expect(await screen.findByText(/Not imported \(1\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the deck" })).toHaveAttribute("href", "/decks/d9");
    expect(screen.queryByText("route: /decks/$deckId")).not.toBeInTheDocument();
  });

  it("needs a name and a readable list before it can create anything", async () => {
    render();
    await fill("", "1 Sol Ring");
    expect(screen.getByRole("button", { name: "Create deck from list" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Name of the imported deck"), "X");
    expect(screen.getByRole("button", { name: "Create deck from list" })).toBeEnabled();
    expect(createDeck).not.toHaveBeenCalled();
  });

  it("names the deck after the file when no name was typed", async () => {
    render();
    await userEvent.click(await screen.findByText("Import a deck"));
    await userEvent.upload(screen.getByLabelText("Deck list file"), new File(["1 Sol Ring"], "Mono Red Burn.txt", { type: "text/plain" }));
    expect(await screen.findByDisplayValue("Mono Red Burn")).toBeInTheDocument();
  });

  it("shows why it failed", async () => {
    importDeck.mockRejectedValue(new Error("Request failed (500)"));
    render();
    await fill("Imported", "1 Sol Ring");
    await userEvent.click(screen.getByRole("button", { name: "Create deck from list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed (500)");
  });
});
