import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const API = "https://api.scryfall.com";
export const HEADERS = {
  "User-Agent": "mtg-vault-importer/0.1 (+https://github.com/JBxrajas/mtg-vault)",
  Accept: "application/json;q=0.9,*/*;q=0.8",
};

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** Download one of Scryfall's bulk files (gzipped JSON Lines) to `path`. */
export async function downloadBulk(type: string, path: string) {
  const { data } = await getJson<{ data: { type: string; jsonl_download_uri: string }[] }>(`${API}/bulk-data`);
  const entry = data.find((d) => d.type === type);
  if (!entry) throw new Error(`Bulk type not found: ${type}`);
  const res = await fetch(entry.jsonl_download_uri, { headers: HEADERS });
  if (!res.ok || !res.body) throw new Error(`Bulk download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(path));
  console.log(`downloaded ${type}`);
}
