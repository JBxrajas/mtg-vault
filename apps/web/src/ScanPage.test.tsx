// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  fetchDecks: vi.fn(),
  addDeckCard: vi.fn(),
  addToCollection: vi.fn(),
  fetchPrintings: vi.fn(),
  lookupCards: vi.fn(),
  loadArtIndex: vi.fn(),
  matchPhoto: vi.fn(),
  beep: vi.fn(),
  primeSound: vi.fn(),
}));
vi.mock("./auth", () => ({ fetchMe: m.fetchMe }));
vi.mock("./decksApi", () => ({ fetchDecks: m.fetchDecks, addDeckCard: m.addDeckCard }));
vi.mock("./collectionApi", () => ({ addToCollection: m.addToCollection }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), fetchPrintings: m.fetchPrintings, lookupCards: m.lookupCards }));
vi.mock("./scan/artIndex", () => ({ loadArtIndex: m.loadArtIndex }));
vi.mock("./scan/capture", () => ({ matchPhoto: m.matchPhoto, focusOf: vi.fn(() => 0), hashGuide: vi.fn(() => new Uint8Array(32)), frameOf: vi.fn() }));
vi.mock("./scan/sound", () => ({ beep: m.beep, primeSound: m.primeSound }));

import { ScanPage } from "./ScanPage";
import { aDeck, aPrinting, aUser, renderPage } from "./test-utils";

const BOLT = "4457ed35-7c10-48c8-9776-456485fdf070";
const COUNTER = "99999999-9999-4999-8999-999999999999";
const entry = (oracleId: string) => ({ illustrationId: oracleId, oracleId, hash: new Uint8Array(32) });
const matches = (...found: [string, number][]) => found.map(([id, distance]) => ({ entry: entry(id), distance }));
const printings = [
  aPrinting({ id: "en-new", lang: "en", releasedAt: "2024-01-01", setName: "Newer Set", setCode: "new", collectorNumber: "5", prices: { usd: 1.5, usdFoil: null, usdEtched: null, eur: null, eurFoil: null, tix: null } }),
  aPrinting({ id: "es-old", lang: "es", releasedAt: "2018-01-01", setName: "Older Set", setCode: "old", collectorNumber: "9", finishes: ["nonfoil", "foil"] }),
];
const photo = () => new File(["x"], "bolt.jpg", { type: "image/jpeg" });

async function openScanner() {
  renderPage(<ScanPage />, { path: "/scan" });
  await screen.findByLabelText("Language of your cards");
}
async function scan(...found: [string, number][]) {
  m.matchPhoto.mockReturnValue(matches(...found));
  await userEvent.upload(screen.getByLabelText("Choose photos"), photo());
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  localStorage.clear();
  m.fetchMe.mockResolvedValue(aUser);
  m.fetchDecks.mockResolvedValue([aDeck({ id: "d1", name: "Elves" })]);
  m.loadArtIndex.mockResolvedValue({ index: [entry(BOLT)], fromCache: true });
  m.fetchPrintings.mockResolvedValue(printings);
  m.lookupCards.mockResolvedValue([
    { oracleId: BOLT, name: "Lightning Bolt", typeLine: "Instant", image: null },
    { oracleId: COUNTER, name: "Counterspell", typeLine: "Instant", image: null },
  ]);
  m.addToCollection.mockResolvedValue({ quantity: 1 });
  m.addDeckCard.mockResolvedValue({});
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
});

describe("ScanPage", () => {
  it("asks to sign in and downloads nothing without a session", async () => {
    m.fetchMe.mockResolvedValue(null);
    renderPage(<ScanPage />, { path: "/scan" });
    expect(await screen.findByText(/Scan cards into your collection or a deck/)).toBeInTheDocument();
    expect(m.loadArtIndex).not.toHaveBeenCalled();
  });

  it("shows the download of the card data, then the scanner", async () => {
    let finish!: (v: unknown) => void;
    m.loadArtIndex.mockImplementation(({ onProgress }: { onProgress: (p: number) => void }) => {
      onProgress(0.5);
      return new Promise((resolve) => (finish = resolve));
    });
    renderPage(<ScanPage />, { path: "/scan" });
    expect(await screen.findByText("Downloading card data… 50%")).toBeInTheDocument();
    expect(screen.getByText(/Your photos never leave it/)).toBeInTheDocument();
    finish({ index: [entry(BOLT)], fromCache: false });
    expect(await screen.findByLabelText("Language of your cards")).toBeInTheDocument();
  });

  it("says so when the card data cannot be loaded, and tries again", async () => {
    m.loadArtIndex.mockRejectedValueOnce(new Error("offline"));
    renderPage(<ScanPage />, { path: "/scan" });
    expect(await screen.findByText("Could not load the card data: offline")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Language of your cards")).toBeInTheDocument();
  });

  it("names a scanned card with its price in a toast, and beeps", async () => {
    await openScanner();
    await scan([BOLT, 40], [COUNTER, 120]);
    expect(await screen.findByRole("status")).toHaveTextContent("Lightning Bolt · $1.50");
    expect(m.beep).toHaveBeenCalled();
    const list = screen.getByRole("region", { name: "Scanned: 1 card" });
    expect(within(list).getByText("Lightning Bolt")).toBeInTheDocument();
    expect(within(list).getByLabelText("Printing")).toHaveDisplayValue("Newer Set (NEW) #5 · en");
  });

  it("suggests the newest printing in the chosen language, and remembers the language", async () => {
    await openScanner();
    await userEvent.selectOptions(screen.getByLabelText("Language of your cards"), "es");
    await scan([BOLT, 40], [COUNTER, 120]);
    expect(await screen.findByLabelText("Printing")).toHaveDisplayValue("Older Set (OLD) #9 · es");
    expect(localStorage.getItem("mtg-vault.scan-language")).toBe("es");
  });

  it("says so, with a low beep, when nothing is recognised", async () => {
    await openScanner();
    await scan([BOLT, 130]);
    expect(await screen.findByRole("status")).toHaveTextContent("No card recognised");
    expect(screen.getByText("Nothing scanned yet.")).toBeInTheDocument();
    expect(m.beep).toHaveBeenCalledWith(220, 160);
  });

  it("counts the same card scanned again as one more copy, not a new row", async () => {
    await openScanner();
    await scan([BOLT, 40], [COUNTER, 120]);
    await screen.findByLabelText("Printing");
    await scan([BOLT, 40], [COUNTER, 120]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Lightning Bolt ×2"));
    expect(screen.getAllByLabelText("Printing")).toHaveLength(1);
    expect(screen.getByLabelText("Qty")).toHaveValue(2);
  });

  it("asks to check a match that is not certain, and offers the other candidates", async () => {
    await openScanner();
    await scan([BOLT, 70], [COUNTER, 78]);
    expect(await screen.findByText(/Not sure: check/)).toBeInTheDocument();
    m.fetchPrintings.mockResolvedValue([aPrinting({ id: "c1", setName: "Counter Set", setCode: "cnt", collectorNumber: "1" })]);
    await userEvent.click(screen.getByRole("button", { name: "Counterspell" }));
    expect(await screen.findByText("Counterspell")).toBeInTheDocument();
    expect(screen.getByLabelText("Printing")).toHaveDisplayValue("Counter Set (CNT) #1 · en");
    expect(screen.queryByText(/Not sure: check/)).not.toBeInTheDocument();
  });

  it("adds everything scanned to the collection with the chosen printing, finish and quantity", async () => {
    await openScanner();
    await scan([BOLT, 40], [COUNTER, 120]);
    await userEvent.selectOptions(await screen.findByLabelText("Printing"), "es-old");
    await userEvent.selectOptions(screen.getByLabelText("Finish"), "foil");
    await userEvent.clear(screen.getByLabelText("Qty"));
    await userEvent.type(screen.getByLabelText("Qty"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Add 1 card" }));
    await waitFor(() => expect(m.addToCollection).toHaveBeenCalledWith({ printingId: "es-old", quantity: 3, finish: "foil", language: "es" }));
    expect(await screen.findByText("Added")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Added 1 card.");
    expect(screen.getByRole("button", { name: "Add 0 cards" })).toBeDisabled();
  });

  it("adds to a deck when one is chosen", async () => {
    await openScanner();
    await userEvent.selectOptions(await screen.findByLabelText("Add to"), "d1");
    await scan([BOLT, 40], [COUNTER, 120]);
    await screen.findByLabelText("Printing");
    await userEvent.click(screen.getByRole("button", { name: "Add 1 card" }));
    await waitFor(() => expect(m.addDeckCard).toHaveBeenCalledWith("d1", { oracleId: BOLT, quantity: 1, printingId: "en-new" }));
    expect(m.addToCollection).not.toHaveBeenCalled();
  });

  it("lets the quantity be emptied and retyped, and follows a rescan of the same card", async () => {
    await openScanner();
    await scan([BOLT, 40], [COUNTER, 120]);
    await screen.findByLabelText("Printing");
    await scan([BOLT, 40], [COUNTER, 120]);
    await waitFor(() => expect(screen.getByLabelText("Qty")).toHaveValue(2));
    await userEvent.clear(screen.getByLabelText("Qty"));
    expect(screen.getByLabelText("Qty")).toHaveValue(null);
    await userEvent.type(screen.getByLabelText("Qty"), "7");
    expect(screen.getByLabelText("Qty")).toHaveValue(7);
    await userEvent.clear(screen.getByLabelText("Qty"));
    await userEvent.tab();
    expect(screen.getByLabelText("Qty")).toHaveValue(1);
  });

  it("keeps a card that could not be added, with the reason, and adds the rest", async () => {
    await openScanner();
    await scan([BOLT, 40], [COUNTER, 120]);
    await screen.findByLabelText("Printing");
    m.addToCollection.mockRejectedValue(new Error("Server said no"));
    await userEvent.click(screen.getByRole("button", { name: "Add 1 card" }));
    expect(await screen.findByText("Server said no")).toBeInTheDocument();
  });

  it("removes a card and clears the list", async () => {
    await openScanner();
    await scan([BOLT, 40], [COUNTER, 120]);
    await screen.findByLabelText("Printing");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Nothing scanned yet.")).toBeInTheDocument();
  });

  it("offers the camera, and explains when it is not available", async () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    await openScanner();
    await userEvent.click(screen.getByRole("button", { name: "Start camera" }));
    expect(m.primeSound).toHaveBeenCalled();
    expect(await screen.findByText(/The camera is not available: This browser has no camera access/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop camera" }));
    expect(screen.getByRole("button", { name: "Start camera" })).toBeInTheDocument();
  });
});
