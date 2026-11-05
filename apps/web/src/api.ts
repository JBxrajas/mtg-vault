import type { CardLookup, CardSearchResult, Color, PrintingSummary } from "@mtg-vault/shared";

export const API_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:3001" : "https://mtg-vault-api.vercel.app");

export interface SearchParams {
  q: string;
  type?: string;
  colors?: Color[];
  limit?: number;
}

export function buildSearchUrl(params: SearchParams, baseUrl: string = API_URL): string {
  const url = new URL("/cards/search", baseUrl);
  url.searchParams.set("q", params.q);
  if (params.type) url.searchParams.set("type", params.type);
  if (params.colors?.length) url.searchParams.set("colors", params.colors.join(","));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  return url.toString();
}

export async function searchCards(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<CardSearchResult[]> {
  const res = await fetch(buildSearchUrl(params), { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const body = (await res.json()) as { results: CardSearchResult[] };
  return body.results;
}

export function buildPrintingsUrl(oracleId: string, baseUrl: string = API_URL): string {
  return new URL(`/cards/${encodeURIComponent(oracleId)}/printings`, baseUrl).toString();
}

export async function fetchPrintings(oracleId: string, signal?: AbortSignal): Promise<PrintingSummary[]> {
  const res = await fetch(buildPrintingsUrl(oracleId), { signal });
  if (!res.ok) throw new Error(`Could not load printings (${res.status})`);
  const body = (await res.json()) as { printings: PrintingSummary[] };
  return body.printings;
}

export async function lookupCards(ids: string[], signal?: AbortSignal): Promise<CardLookup[]> {
  const url = new URL("/cards/lookup", API_URL);
  url.searchParams.set("ids", ids.join(","));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not look up the cards (${res.status})`);
  return ((await res.json()) as { cards: CardLookup[] }).cards;
}
