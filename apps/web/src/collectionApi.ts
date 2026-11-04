import type { CollectionEntry, CollectionItem, UpdateCollectionItem } from "@mtg-vault/shared";
import { API_URL } from "./api";
import { authHeaders, errorMessage, getToken } from "./auth";

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error("Sign in to use your collection");
  const res = await fetch(new URL(path, API_URL), {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...authHeaders(token) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res;
}

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
