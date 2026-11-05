// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchArt } = vi.hoisted(() => ({ fetchArt: vi.fn() }));
vi.mock("./art", async (importOriginal) => ({ ...(await importOriginal<typeof import("./art")>()), fetchArt }));

import { ArtPage } from "./ArtPage";
import { renderPage } from "./test-utils";

const ID = "bba5ea18-4e58-42a8-b613-2178706476a6";
const art = "https://cards.scryfall.io/art_crop/front/b/b/x.jpg";
const png = "https://cards.scryfall.io/png/front/b/b/x.png";
const info = {
  name: "Lightning Bolt",
  setName: "Secret Lair",
  setCode: "slc",
  collectorNumber: "83",
  releasedAt: "2025-01-02",
  scryfallUri: "https://scryfall.com/card/slc/83/lightning-bolt",
  faces: [{ name: "Lightning Bolt", artist: "Christopher Moeller", artCrop: art, png, flavorText: "The sparkmage shrieked." }],
};
const render = (id = ID) => renderPage(<ArtPage />, { path: `/art/${id}`, route: "/art/$printingId" });

beforeEach(() => {
  fetchArt.mockReset(); // not returned: a function returned from beforeEach would run as a cleanup
});

describe("ArtPage", () => {
  it("shows the art, how big it is, the artist with a link to more of their art, and the card on Scryfall", async () => {
    fetchArt.mockResolvedValue(info);
    render();
    expect(await screen.findByRole("heading", { name: "High-resolution art" })).toBeInTheDocument();
    expect(await screen.findByAltText("Lightning Bolt")).toHaveAttribute("src", art);
    expect(screen.getByText(/Art only, 626 × 457 px/)).toBeInTheDocument();
    expect(screen.getByText("Christopher Moeller")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /More art by Christopher Moeller on Scryfall/ })).toHaveAttribute("href", expect.stringContaining("a%3A%22Christopher%20Moeller%22"));
    expect(screen.getByRole("link", { name: /View this card on Scryfall/ })).toHaveAttribute("href", info.scryfallUri);
    expect(screen.getByText("Secret Lair (SLC) #83")).toBeInTheDocument();
    expect(screen.getByText("The sparkmage shrieked.")).toBeInTheDocument();
    // Every outside link opens in a new window without handing it the page.
    for (const link of screen.getAllByRole("link", { name: /↗/ })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("switches to the full card and says its size", async () => {
    fetchArt.mockResolvedValue(info);
    render();
    await userEvent.click(await screen.findByRole("button", { name: "Full card" }));
    expect(screen.getByAltText("Lightning Bolt")).toHaveAttribute("src", png);
    expect(screen.getByText(/Full card, 745 × 1040 px/)).toBeInTheDocument();
  });

  it("offers each face of a double-faced card", async () => {
    fetchArt.mockResolvedValue({ ...info, name: "A // B", faces: [{ ...info.faces[0]!, name: "A" }, { ...info.faces[0]!, name: "B", artist: "Other Artist" }] });
    render();
    const faces = await screen.findByRole("group", { name: "Faces of the card" });
    await userEvent.click(within(faces).getByRole("button", { name: "B" }));
    expect(screen.getByText("Other Artist")).toBeInTheDocument();
  });

  it("says so when Scryfall cannot be reached", async () => {
    fetchArt.mockRejectedValue(new Error("Scryfall answered 404"));
    render();
    expect(await screen.findByText(/Could not load the art from Scryfall: Scryfall answered 404/)).toBeInTheDocument();
  });

  it("does not call Scryfall for an address that is not a card id", async () => {
    render("not-a-uuid");
    expect(await screen.findByText("This is not a valid card address.")).toBeInTheDocument();
    expect(fetchArt).not.toHaveBeenCalled();
  });
});
