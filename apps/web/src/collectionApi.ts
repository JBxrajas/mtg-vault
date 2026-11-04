import type { CollectionEntry, CollectionItem, UpdateCollectionItem } from "@mtg-vault/shared";
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
