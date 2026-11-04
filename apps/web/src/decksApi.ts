import {
  IMPORT_CHUNK,
  type DeckCard,
  type DeckCardSet,
  type DeckDetail,
  type DeckImportResult,
  type DeckImportRow,
  type DeckInput,
  type DeckSummary,
  type DeckUpdate,
} from "@mtg-vault/shared";
import { authedFetch } from "./authedFetch";

export async function fetchDecks(): Promise<DeckSummary[]> {
  return ((await (await authedFetch("GET", "/decks")).json()) as { decks: DeckSummary[] }).decks;
}

/** The create form leaves the optional fields out; the API fills them in. */
export type NewDeck = Pick<DeckInput, "name"> & Partial<Omit<DeckInput, "name">>;

export async function createDeck(input: NewDeck): Promise<DeckSummary> {
  return ((await (await authedFetch("POST", "/decks", input)).json()) as { deck: DeckSummary }).deck;
}

export async function fetchDeck(id: string): Promise<DeckDetail> {
  return (await (await authedFetch("GET", `/decks/${id}`)).json()) as DeckDetail;
}

export async function updateDeck(id: string, patch: DeckUpdate): Promise<DeckSummary> {
  return ((await (await authedFetch("PATCH", `/decks/${id}`, patch)).json()) as { deck: DeckSummary }).deck;
}

export async function deleteDeck(id: string): Promise<void> {
  await authedFetch("DELETE", `/decks/${id}`);
}

/** Adds copies of a card to a board. Answers with the updated deck. */
export async function addDeckCard(id: string, card: Partial<Pick<DeckCard, "board" | "printingId">> & Pick<DeckCard, "oracleId" | "quantity">): Promise<DeckDetail> {
  return (await (await authedFetch("POST", `/decks/${id}/cards`, card)).json()) as DeckDetail;
}

/** Sets the copies of a card on a board; 0 removes it. Answers with the updated deck. */
export async function setDeckCard(id: string, card: Partial<Pick<DeckCardSet, "board">> & Pick<DeckCardSet, "oracleId" | "quantity">): Promise<DeckDetail> {
  return (await (await authedFetch("PUT", `/decks/${id}/cards`, card)).json()) as DeckDetail;
}

/**
 * Imports a deck list into a deck in chunks (the API takes at most 1000 rows per request) and adds the reports up.
 * `onProgress` receives the rows sent so far. Stops at the first request that fails.
 */
export async function importDeck(
  id: string,
  rows: DeckImportRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<DeckImportResult> {
  const total: DeckImportResult = { created: 0, updated: 0, unchanged: 0, problems: [] };
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
    const part = (await (await authedFetch("POST", `/decks/${id}/import`, { rows: rows.slice(i, i + IMPORT_CHUNK) })).json()) as DeckImportResult;
    total.created += part.created;
    total.updated += part.updated;
    total.unchanged += part.unchanged;
    total.problems.push(...part.problems);
    onProgress?.(Math.min(i + IMPORT_CHUNK, rows.length), rows.length);
  }
  return total;
}
