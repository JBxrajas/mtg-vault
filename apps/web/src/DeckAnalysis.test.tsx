// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openSideWindow } = vi.hoisted(() => ({ openSideWindow: vi.fn() }));
vi.mock("./edhrec", async (original) => ({ ...(await original<typeof import("./edhrec")>()), openSideWindow }));

import { DeckAnalysis } from "./DeckAnalysis";
import { setLocale } from "./i18n";
import { aDeckCard, renderPage } from "./test-utils";

const commander = aDeckCard({
  oracleId: "c1",
  name: "Atraxa, Praetors' Voice",
  board: "commander",
  quantity: 1,
  cmc: 4,
  typeLine: "Legendary Creature — Phyrexian Angel",
  colorIdentity: ["W", "U", "B", "G"],
});
const forest = aDeckCard({ oracleId: "f", name: "Forest", typeLine: "Basic Land — Forest", cmc: 0, quantity: 36, colorIdentity: ["G"] });
const solRing = aDeckCard({ oracleId: "s", name: "Sol Ring", typeLine: "Artifact", cmc: 1, quantity: 1, oracleText: "{T}: Add {C}{C}." });
const cultivate = aDeckCard({
  oracleId: "cu",
  name: "Cultivate",
  typeLine: "Sorcery",
  cmc: 3,
  quantity: 1,
  oracleText: "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
});
const bolt = aDeckCard({ oracleId: "b", name: "Lightning Bolt", cmc: 1, quantity: 1, oracleText: "Lightning Bolt deals 3 damage to any target.", colorIdentity: ["R"] });

/** The router renders on the next tick: wait for the panel before looking inside it. */
const render = async (cards = [commander, forest, solRing, cultivate]) => {
  const view = renderPage(<DeckAnalysis cards={cards} />);
  await screen.findByRole("region", { name: /Commander analysis|Análisis del comandante/ });
  return view;
};

beforeEach(() => openSideWindow.mockReset());

describe("DeckAnalysis", () => {
  it("shows the commander, its color identity and the counts of lands and roles", async () => {
    await render();
    const panel = screen.getByRole("region", { name: "Commander analysis" });
    expect(within(panel).getByText("Commander: Atraxa, Praetors' Voice")).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: "{W}{U}{B}{G}" })).toBeInTheDocument();
    const stat = (label: RegExp) => within(panel).getByText(label).previousElementSibling;
    expect(stat(/^lands/)).toHaveTextContent("36");
    expect(stat(/^ramp/)).toHaveTextContent("2");
    expect(stat(/^card draw/)).toHaveTextContent("0");
    expect(stat(/^average mana value/)).toHaveTextContent("2");
  });

  it("says there is no commander yet, and does not offer an EDHREC link", async () => {
    await render([forest, solRing]);
    expect(screen.getByText(/No commander yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /on EDHREC/ })).not.toBeInTheDocument();
  });

  it("links to the commander on EDHREC in a new tab, with no access back to this page", async () => {
    await render();
    const link = screen.getByRole("link", { name: /Atraxa, Praetors' Voice on EDHREC/ });
    expect(link).toHaveAttribute("href", "https://edhrec.com/commanders/atraxa-praetors-voice");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toMatch(/noopener/);
    expect(link.getAttribute("rel")).toMatch(/noreferrer/);
  });

  it("opens the commander's EDHREC page in a side window", async () => {
    await render();
    await userEvent.click(screen.getByRole("button", { name: "Open Atraxa, Praetors' Voice on EDHREC in a side window" }));
    expect(openSideWindow).toHaveBeenCalledWith("https://edhrec.com/commanders/atraxa-praetors-voice");
  });

  it("draws the mana curve with a readable label per slot", async () => {
    await render();
    expect(screen.getByLabelText("Mana value 1: 1 card")).toBeInTheDocument();
    expect(screen.getByLabelText("Mana value 3: 1 card")).toBeInTheDocument();
    expect(screen.getByLabelText("Mana value 7+: 0 cards")).toBeInTheDocument();
  });

  it("asks for spells when there is nothing to draw", async () => {
    await render([commander, forest]);
    expect(screen.getByText("Add some spells to see the curve.")).toBeInTheDocument();
  });

  it("lists rule problems apart from advice, and says nothing is blocked", async () => {
    await render([commander, forest, bolt]);
    const rules = screen.getByRole("heading", { name: "Format rules" }).nextElementSibling as HTMLElement;
    expect(within(rules).getByText(/A Commander deck has 100 cards; this one has 38/)).toBeInTheDocument();
    expect(within(rules).getByText(/1 card is outside the commander's color identity: Lightning Bolt/)).toBeInTheDocument();
    expect(screen.getByText("These are warnings only; nothing is blocked.")).toBeInTheDocument();
  });

  it("gives balance advice only once the deck has taken shape", async () => {
    await render();
    expect(screen.queryByRole("heading", { name: "Suggestions" })).not.toBeInTheDocument();
    const big = [commander, { ...forest, quantity: 30 }, ...Array.from({ length: 69 }, (_, i) => aDeckCard({ oracleId: `x${i}`, name: `Bear ${i}`, cmc: 3, quantity: 1 }))];
    await render(big);
    expect(screen.getByRole("heading", { name: "Suggestions" })).toBeInTheDocument();
    expect(screen.getByText(/You run 30 lands and the formula suggests about 41/)).toBeInTheDocument();
    expect(screen.getByText(/Ramp: 0, where decks usually run 8–12/)).toBeInTheDocument();
  });

  it("explains the five brackets and links to the official announcement", async () => {
    await render();
    await userEvent.click(screen.getByText("Brackets guide"));
    expect(screen.getByText(/3 · Upgraded/)).toBeInTheDocument();
    expect(screen.getByText("Game Changers: up to 3")).toBeInTheDocument();
    expect(screen.getByText(/Game Changers are not checked yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Official announcement/ })).toHaveAttribute("href", expect.stringContaining("magic.wizards.com"));
  });

  it("names where the numbers come from, with how much to trust each", async () => {
    await render();
    await userEvent.click(screen.getByText("Where the numbers come from"));
    const sources = screen.getByText(/Frank Karsten/).closest("li") as HTMLElement;
    expect(within(sources).getByText("simulation")).toBeInTheDocument();
    expect(screen.getByText("official")).toBeInTheDocument();
    expect(screen.getByText("community advice")).toBeInTheDocument();
  });

  it("speaks Spanish", async () => {
    setLocale("es");
    await render();
    const panel = screen.getByRole("region", { name: "Análisis del comandante" });
    expect(within(panel).getByText("Comandante: Atraxa, Praetors' Voice")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Atraxa, Praetors' Voice en EDHREC/ })).toBeInTheDocument();
    expect(within(panel).getByLabelText("Valor de maná 1: 1 carta")).toBeInTheDocument();
    expect(within(panel).getByText("Curva de maná")).toBeInTheDocument();
  });
});
