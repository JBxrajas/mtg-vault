// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchCards, fetchPrintings } = vi.hoisted(() => ({ searchCards: vi.fn(), fetchPrintings: vi.fn() }));
vi.mock("./api", () => ({ searchCards, fetchPrintings }));

import { AppearancePage } from "./AppearancePage";
import { getAppearance, resetAppearance } from "./appearance";
import { aCard, aPrinting, renderPage } from "./test-utils";

const ART = "https://cards.scryfall.io/art_crop/front/b/d/bd8fa327.jpg?1";

beforeEach(() => {
  searchCards.mockReset();
  fetchPrintings.mockReset();
  fetchPrintings.mockResolvedValue([]);
  localStorage.clear();
  resetAppearance();
});

describe("AppearancePage", () => {
  it("switches mode and marks the active one", async () => {
    renderPage(<AppearancePage />, { path: "/appearance" });
    const mode = within(await screen.findByRole("group", { name: "Mode" }));
    expect(mode.getByRole("button", { name: "Automatic" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(mode.getByRole("button", { name: "Dark" }));
    expect(mode.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("picks a background color", async () => {
    renderPage(<AppearancePage />, { path: "/appearance" });
    await userEvent.click(await screen.findByRole("button", { name: "Blue" }));
    expect(getAppearance().background).toBe("blue");
    expect(document.documentElement.getAttribute("data-bg")).toBe("blue");
  });

  it("searches cards, uses one's art as the background and removes it", async () => {
    searchCards.mockResolvedValue([
      aCard({ name: "Black Lotus", image: { small: "s", normal: "n", artCrop: ART } }),
      aCard({ oracleId: "x", name: "No safe art", image: { small: "s", normal: "n", artCrop: "https://evil.example/a.jpg" } }),
    ]);
    renderPage(<AppearancePage />, { path: "/appearance" });
    await userEvent.type(await screen.findByLabelText("Search card art"), "lotus");

    await userEvent.click(await screen.findByRole("button", { name: "Use the art of Black Lotus" }));
    expect(screen.queryByRole("button", { name: /No safe art/ })).not.toBeInTheDocument();
    expect(getAppearance().art).toEqual({ url: ART, name: "Black Lotus", oracleId: aCard().oracleId });
    expect(document.documentElement.hasAttribute("data-art")).toBe(true);
    expect(screen.getByText("Black Lotus", { selector: "strong" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove the art" }));
    expect(getAppearance().art).toBeNull();
    expect(document.documentElement.hasAttribute("data-art")).toBe(false);
  });

  it("choosing a color replaces the art, and reset restores the default look", async () => {
    searchCards.mockResolvedValue([aCard({ name: "Black Lotus", image: { small: "s", normal: "n", artCrop: ART } })]);
    renderPage(<AppearancePage />, { path: "/appearance" });
    await userEvent.type(await screen.findByLabelText("Search card art"), "lotus");
    await userEvent.click(await screen.findByRole("button", { name: "Use the art of Black Lotus" }));
    await userEvent.click(screen.getByRole("button", { name: "Red" }));
    expect(getAppearance()).toMatchObject({ background: "red", art: null });

    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to the default look" }));
    expect(getAppearance()).toMatchObject({ mode: "system", background: "default", art: null });
  });

  it("lets the dimming be changed while art is used", async () => {
    searchCards.mockResolvedValue([aCard({ name: "Black Lotus", image: { small: "s", normal: "n", artCrop: ART } })]);
    renderPage(<AppearancePage />, { path: "/appearance" });
    await userEvent.type(await screen.findByLabelText("Search card art"), "lotus");
    await userEvent.click(await screen.findByRole("button", { name: "Use the art of Black Lotus" }));
    const slider = screen.getByRole("slider", { name: "Dimming" });
    fireEvent.change(slider, { target: { value: "90" } });
    expect(getAppearance().dimming).toBe(90);
    expect(document.documentElement.style.getPropertyValue("--art-scrim")).toBe("0.9");
  });

  describe("printing of the chosen card", () => {
    const art = (n: number) => ({ small: "s", normal: "n", artCrop: `https://cards.scryfall.io/art_crop/front/${n}/a.jpg?1` });
    const printings = [
      aPrinting({ id: "p1", setName: "Limited Edition Alpha", setCode: "lea", collectorNumber: "232", image: art(1) }),
      aPrinting({ id: "p2", setName: "Limited Edition Beta", setCode: "leb", collectorNumber: "233", image: art(1) }), // same picture as p1
      aPrinting({ id: "p3", setName: "Vintage Masters", setCode: "vma", collectorNumber: "1", image: art(3) }),
      aPrinting({ id: "p4", setName: "Odd", setCode: "odd", collectorNumber: "9", image: { small: "s", normal: "n", artCrop: "https://evil.example/a.jpg" } }),
    ];

    const pickLotus = async () => {
      searchCards.mockResolvedValue([aCard({ name: "Black Lotus", image: { small: "s", normal: "n", artCrop: art(1).artCrop } })]);
      renderPage(<AppearancePage />, { path: "/appearance" });
      await userEvent.type(await screen.findByLabelText("Search card art"), "lotus");
      await userEvent.click(await screen.findByRole("button", { name: "Use the art of Black Lotus" }));
    };

    it("offers each different art of the card once, and switches to the one picked", async () => {
      fetchPrintings.mockResolvedValue(printings);
      await pickLotus();
      expect(fetchPrintings).toHaveBeenCalledWith(aCard().oracleId, expect.anything());

      const alpha = await screen.findByRole("button", { name: "Use the art from Limited Edition Alpha (LEA) #232" });
      expect(alpha).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("button", { name: /Limited Edition Beta/ })).not.toBeInTheDocument(); // same picture as Alpha
      expect(screen.queryByRole("button", { name: /Odd/ })).not.toBeInTheDocument(); // not a Scryfall address

      await userEvent.click(screen.getByRole("button", { name: "Use the art from Vintage Masters (VMA) #1" }));
      expect(getAppearance().art).toEqual({ url: art(3).artCrop, name: "Black Lotus", oracleId: aCard().oracleId });
      expect(screen.getByRole("button", { name: /Vintage Masters/ })).toHaveAttribute("aria-pressed", "true");
      expect(alpha).toHaveAttribute("aria-pressed", "false");
    });

    it("shows nothing to pick before a card is chosen, and says when no art was found", async () => {
      renderPage(<AppearancePage />, { path: "/appearance" });
      await screen.findByRole("heading", { name: "Appearance" });
      expect(screen.queryByRole("heading", { name: "Printing" })).not.toBeInTheDocument();
      expect(fetchPrintings).not.toHaveBeenCalled();
    });

    it("explains when the card has no art to offer", async () => {
      fetchPrintings.mockResolvedValue([]);
      await pickLotus();
      expect(await screen.findByRole("heading", { name: "Printing" })).toBeInTheDocument();
      expect(await screen.findByText("No art found.")).toBeInTheDocument();
    });
  });
});
