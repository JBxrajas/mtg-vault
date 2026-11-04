// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { importDeck, downloadText } = vi.hoisted(() => ({ importDeck: vi.fn(), downloadText: vi.fn() }));
vi.mock("./decksApi", () => ({ importDeck }));
vi.mock("./download", async (original) => ({ ...(await original<typeof import("./download")>()), downloadText }));

import { DeckListTools } from "./DeckListTools";
import { aDeckCard, renderPage } from "./test-utils";

const cards = [
  aDeckCard({ oracleId: "a", name: "Atraxa, Praetors' Voice", board: "commander", quantity: 1 }),
  aDeckCard({ oracleId: "b", name: "Lightning Bolt", board: "main", quantity: 4 }),
  aDeckCard({ oracleId: "c", name: "Pyroblast", board: "sideboard", quantity: 2 }),
];
const render = (over: Partial<Parameters<typeof DeckListTools>[0]> = {}) =>
  renderPage(<DeckListTools deckId="d1" deckName="Mono red" cards={cards} {...over} />);

beforeEach(() => {
  importDeck.mockReset();
  downloadText.mockReset();
});

const open = async () => {
  await userEvent.click(await screen.findByText("Import / export list"));
};

describe("DeckListTools: export", () => {
  it("downloads the list as a .txt named after the deck", async () => {
    render({ deckName: 'Mono R/G: "burn"' });
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Download .txt" }));
    expect(downloadText).toHaveBeenCalledWith(
      "Mono R G burn.txt",
      "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n4 Lightning Bolt\n\nSideboard\n2 Pyroblast\n",
    );
  });

  it("copies the list to the clipboard and says so, or says it could not", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Copy list" }));
    expect(writeText).toHaveBeenCalledWith("Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n4 Lightning Bolt\n\nSideboard\n2 Pyroblast");
    expect(await screen.findByText("Copied.")).toBeInTheDocument();

    writeText.mockRejectedValue(new Error("denied"));
    await userEvent.click(screen.getByRole("button", { name: "Copy list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy");
    vi.unstubAllGlobals();
  });

  it("has nothing to export from an empty deck", async () => {
    render({ cards: [] });
    await open();
    expect(screen.getByRole("button", { name: "Copy list" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download .txt" })).toBeDisabled();
  });
});

describe("DeckListTools: import", () => {
  const paste = async (text: string) => {
    await userEvent.click(await screen.findByLabelText("Deck list"));
    await userEvent.paste(text);
  };

  it("previews the list, then sends the rows to the deck and reports the result", async () => {
    importDeck.mockResolvedValue({ created: 2, updated: 0, unchanged: 0, problems: [{ line: 3, name: "Lightnin Bolt", reason: "No card found" }] });
    render();
    await open();
    await paste("4 Lightning Bolt\n20 Mountain\n0 Sol Ring\n\nSideboard\n2 Pyroblast");

    expect(screen.getByText("26 cards ready to import")).toBeInTheDocument();
    expect(screen.getByText(/Lines that cannot be read \(1\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Import 26 cards" }));
    expect(importDeck).toHaveBeenCalledWith(
      "d1",
      [
        { line: 1, name: "Lightning Bolt", quantity: 4, board: "main" },
        { line: 2, name: "Mountain", quantity: 20, board: "main" },
        { line: 6, name: "Pyroblast", quantity: 2, board: "sideboard" },
      ],
      expect.any(Function),
    );
    const result = await screen.findByRole("status");
    expect(result).toHaveTextContent("Done: 2 new, 0 updated, 0 already up to date.");
    expect(within(result).getByText(/Not imported \(1\)/)).toBeInTheDocument();
  });

  it("cannot import an empty or unreadable text", async () => {
    render();
    await open();
    expect(screen.getByRole("button", { name: "Import 0 cards" })).toBeDisabled();
    await paste("0 Sol Ring");
    expect(screen.getByRole("button", { name: "Import 0 cards" })).toBeDisabled();
    expect(importDeck).not.toHaveBeenCalled();
  });

  it("shows why the import failed", async () => {
    importDeck.mockRejectedValue(new Error("Deck not found"));
    render();
    await open();
    await paste("1 Sol Ring");
    await userEvent.click(screen.getByRole("button", { name: "Import 1 card" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Deck not found");
  });

  it("loads the list from a .txt file", async () => {
    render();
    await open();
    const file = new File(["3 Island\n1 Sol Ring"], "my deck.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Deck list file"), file);
    await waitFor(() => expect(screen.getByLabelText("Deck list")).toHaveValue("3 Island\n1 Sol Ring"));
    expect(screen.getByText("4 cards ready to import")).toBeInTheDocument();
  });
});
