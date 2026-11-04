// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchCards } = vi.hoisted(() => ({ searchCards: vi.fn() }));
vi.mock("./api", () => ({ searchCards }));

import { AppearancePage } from "./AppearancePage";
import { getAppearance, resetAppearance } from "./appearance";
import { aCard, renderPage } from "./test-utils";

const ART = "https://cards.scryfall.io/art_crop/front/b/d/bd8fa327.jpg?1";

beforeEach(() => {
  searchCards.mockReset();
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
    expect(getAppearance().art).toEqual({ url: ART, name: "Black Lotus" });
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
});
