import {
  IMPORT_CHUNK,
  type CollectionEntry,
  type CollectionItem,
  type ImportResult,
  type ImportRowInput,
  type UpdateCollectionItem,
} from "@mtg-vault/shared";
import { authedFetch } from "./authedFetch";

const request = authedFetch;

export async function fetchCollection(): Promise<CollectionItem[]> {
  return ((await (await request("GET", "/collection/items")).json()) as { items: CollectionItem[] }).items;
}

/** Input as the form has it: defaults are filled in by the API. */
export type AddToCollection = Pick<CollectionEntry, "printingId" | "quantity"> &
  Partial<Pick<CollectionEntry, "finish" | "condition" | "language" | "purchasePrice" | "acquiredOn" | "notes">>;

export async function addToCollection(entry: AddToCollection): Promise<CollectionItem> {
  return ((await (await request("POST", "/collection/items", entry)).json()) as { item: CollectionItem }).item;
}

export async function updateCollectionItem(id: string, patch: UpdateCollectionItem): Promise<CollectionItem> {
  return ((await (await request("PATCH", `/collection/items/${id}`, patch)).json()) as { item: CollectionItem }).item;
}

export async function removeFromCollection(id: string): Promise<void> {
  await request("DELETE", `/collection/items/${id}`);
}

/**
 * Imports rows in chunks (the API takes at most 1000 per request) and adds the reports up.
 * `onProgress` receives the rows sent so far. Stops at the first request that fails.
 */
export async function importCollection(
  rows: ImportRowInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const total: ImportResult = { created: 0, updated: 0, unchanged: 0, adjusted: [], problems: [] };
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
    const chunk = rows.slice(i, i + IMPORT_CHUNK);
    const part = (await (await request("POST", "/collection/import", { rows: chunk })).json()) as ImportResult;
    total.created += part.created;
    total.updated += part.updated;
    total.unchanged += part.unchanged;
    total.adjusted.push(...part.adjusted);
    total.problems.push(...part.problems);
    onProgress?.(Math.min(i + IMPORT_CHUNK, rows.length), rows.length);
  }
  return total;
}
