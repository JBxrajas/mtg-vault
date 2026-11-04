// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchCards, fetchPrintings, fetchMe } = vi.hoisted(() => ({
  searchCards: vi.fn(),
  fetchPrintings: vi.fn(),
  fetchMe: vi.fn(),
}));
vi.mock("./api", () => ({ searchCards, fetchPrintings }));
vi.mock("./auth", () => ({ fetchMe, logout: vi.fn() }));
vi.mock("./collectionApi", () => ({ addToCollection: vi.fn() }));

import { SearchPage } from "./SearchPage";
import { aCard, aPrinting, renderPage } from "./test-utils";

beforeEach(() => {
  searchCards.mockReset();
  fetchPrintings.mockReset();
  fetchMe.mockReset();
  fetchMe.mockResolvedValue(null);
});

describe("SearchPage", () => {
  it("asks for at least 2 characters and does not call the API before that", async () => {
    renderPage(<SearchPage />);
    const input = await screen.findByLabelText("Card name");
    expect(screen.getByText("Type at least 2 characters.")).toBeInTheDocument();
    await userEvent.type(input, "b");
    await new Promise((r) => setTimeout(r, 450));
    expect(searchCards).not.toHaveBeenCalled();
  });

  it("searches once the typing settles and lists name, mana cost, type and image", async () => {
    searchCards.mockResolvedValue([aCard()]);
    renderPage(<SearchPage />);
    await userEvent.type(await screen.findByLabelText("Card name"), "bolt");

    expect(await screen.findByText("Lightning Bolt")).toBeInTheDocument();
    expect(screen.getByText("{R}")).toBeInTheDocument();
    expect(screen.getByText("Instant")).toBeInTheDocument();
    const img = document.querySelector("img.thumb, .thumb img") as HTMLImageElement;
    expect(img).toHaveAttribute("src", "https://img.example/small.jpg");
    expect(img).toHaveAttribute("loading", "lazy");

    // Debounced: the four keystrokes produce one request for the full text.
    const calls = searchCards.mock.calls.map((c) => c[0].q);
    expect(calls).toEqual(["bolt"]);
  });

  it("says when nothing matches", async () => {
    searchCards.mockResolvedValue([]);
    renderPage(<SearchPage />);
    await userEvent.type(await screen.findByLabelText("Card name"), "zzzz");
    expect(await screen.findByText("No cards found.")).toBeInTheDocument();
  });

  it("shows the error when the search fails", async () => {
    searchCards.mockRejectedValue(new Error("Search failed (500)"));
    renderPage(<SearchPage />);
    await userEvent.type(await screen.findByLabelText("Card name"), "bolt");
    expect(await screen.findByText(/Could not search: Search failed \(500\)/)).toBeInTheDocument();
  });

  it("sends the type filter and the selected colors", async () => {
    searchCards.mockResolvedValue([aCard()]);
    renderPage(<SearchPage />);
    await userEvent.type(await screen.findByLabelText("Card name"), "bolt");
    await userEvent.type(screen.getByLabelText("Type line contains"), "instant");
    const red = within(screen.getByRole("group", { name: "Color identity" })).getByRole("button", { name: "R" });
    await userEvent.click(red);
    expect(red).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      const last = searchCards.mock.calls.at(-1)![0];
      expect(last).toMatchObject({ q: "bolt", type: "instant", colors: ["R"] });
    });

    await userEvent.click(red);
    expect(red).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the card dialog with every printing, its set name and price, and closes it", async () => {
    searchCards.mockResolvedValue([aCard()]);
    fetchPrintings.mockResolvedValue([
      aPrinting(),
      aPrinting({ id: "p2", setName: "Foundations", setCode: "fdn", collectorNumber: "224", prices: null, releasedAt: "2024-11-15" }),
    ]);
    renderPage(<SearchPage />);
    await userEvent.type(await screen.findByLabelText("Card name"), "bolt");
    await userEvent.click(await screen.findByRole("button", { name: "Show Lightning Bolt" }));

    const dialog = await screen.findByRole("dialog", { name: "Lightning Bolt" });
    expect(await within(dialog).findByText("Limited Edition Alpha (LEA) #161")).toBeInTheDocument();
    expect(within(dialog).getByText("$630.00 · €387.57")).toBeInTheDocument();
    expect(within(dialog).getByText("Foundations (FDN) #224")).toBeInTheDocument();
    expect(within(dialog).getByText("No price yet")).toBeInTheDocument();
    expect(within(dialog).getByText("2 printings")).toBeInTheDocument();
    expect(fetchPrintings).toHaveBeenCalledWith("4457ed35-7c10-48c8-9776-456485fdf070", expect.anything());

    // Choosing another printing swaps the big image.
    expect(within(dialog).getByAltText("Lightning Bolt")).toHaveAttribute("src", "https://img.example/a-normal.jpg");
    await userEvent.click(within(dialog).getByText("Foundations (FDN) #224"));

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
