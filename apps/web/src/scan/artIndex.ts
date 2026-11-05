import { decodeArtIndex, type ArtIndexEntry } from "@mtg-vault/shared";
import { API_URL } from "../api";

/** Where the downloaded file is kept on the device, so it is fetched once and not on every visit. */
export interface IndexStore {
  get(): Promise<{ bytes: Uint8Array; savedAt: number } | null>;
  set(bytes: Uint8Array, savedAt: number): Promise<void>;
}

const DB = "mtg-vault-scan";
const STORE = "files";
const KEY = "art-index";
/** The index is rebuilt weekly; a copy younger than this is used without asking the server. */
export const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB, or nothing at all when the browser refuses it (private windows): the file is then downloaded each time. */
export const browserStore: IndexStore = {
  async get() {
    try {
      const db = await open();
      return await new Promise((resolve) => {
        const req = db.transaction(STORE).objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve((req.result as { bytes: Uint8Array; savedAt: number } | undefined) ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },
  async set(bytes, savedAt) {
    try {
      const db = await open();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ bytes, savedAt }, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {
      // Not keeping a copy is fine.
    }
  },
};

export interface LoadOptions {
  store?: IndexStore;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Share downloaded (0 to 1), or null when the size is not known. */
  onProgress?: (fraction: number | null) => void;
  signal?: AbortSignal;
}

/** Reads a response body, reporting progress against its Content-Length when it has one. */
async function readBody(res: Response, onProgress?: LoadOptions["onProgress"]): Promise<Uint8Array> {
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    // The size may be the compressed one: never report more than 99% before the end.
    onProgress?.(total ? Math.min(0.99, got / total) : null);
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  return bytes;
}

/**
 * The art index: the copy kept on the device if it is recent, otherwise a fresh download (kept for next
 * time). If the download fails, an older copy is better than none.
 */
export async function loadArtIndex(options: LoadOptions = {}): Promise<{ index: ArtIndexEntry[]; fromCache: boolean }> {
  const { store = browserStore, fetchFn = fetch, now = Date.now, onProgress, signal } = options;
  const cached = await store.get();
  const decodeCached = () => ({ index: decodeArtIndex(cached!.bytes), fromCache: true });
  if (cached && now() - cached.savedAt < MAX_AGE_MS) {
    try {
      return decodeCached();
    } catch {
      // A damaged copy: download again.
    }
  }
  try {
    const res = await fetchFn(`${API_URL}/art-index`, { signal });
    if (res.status === 503) throw new Error("The card index has not been published yet");
    if (!res.ok) throw new Error(`Could not download the card index (${res.status})`);
    const bytes = await readBody(res, onProgress);
    const index = decodeArtIndex(bytes);
    await store.set(bytes, now());
    onProgress?.(1);
    return { index, fromCache: false };
  } catch (e) {
    if (cached && !signal?.aborted) {
      try {
        return decodeCached();
      } catch {
        // fall through to the real error
      }
    }
    throw e;
  }
}
