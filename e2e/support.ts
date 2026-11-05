import type { Page } from "@playwright/test";
import type { DeckCardEntry, DeckDetail } from "@mtg-vault/shared";

const API = "http://localhost:3001";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

export const card = (over: Partial<DeckCardEntry>): DeckCardEntry => ({
  oracleId: "o",
  name: "Card",
  manaCost: null,
  cmc: 0,
  oracleText: null,
  colorIdentity: [],
  typeLine: "Instant",
  board: "main",
  quantity: 1,
  printingId: null,
  image: null,
  owned: 0,
  ...over,
});

/** A long Commander deck, so the page scrolls. */
export function commanderDeck(): DeckDetail {
  const filler = Array.from({ length: 40 }, (_, i) => card({ oracleId: `f${i}`, name: `Filler ${i}`, typeLine: "Creature — Bear", cmc: 2 }));
  return {
    deck: { id: "d1", name: "Test deck", format: "commander", description: null, isPublic: false, cardCount: 41, updatedAt: "2026-11-04T10:00:00Z" },
    cards: [
      card({ oracleId: "c1", name: "Iroh, Grand Lotus", board: "commander", typeLine: "Legendary Creature — Human", colorIdentity: ["U", "R", "G"], manaCost: "{3}{G}{U}{R}", cmc: 6 }),
      ...filler,
    ],
  };
}

/** Signs in and answers the deck endpoints from memory. Everything else gets an empty answer. */
export async function mockApi(page: Page, deck: DeckDetail) {
  await page.addInitScript(() => localStorage.setItem("mtg-vault.token", "test"));
  await page.route(`${API}/**`, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname;
    const body = path === "/me" ? { user: { id: "u1", username: "alice", displayUsername: "Alice" } } : path === "/decks/d1" ? deck : {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  });
}
