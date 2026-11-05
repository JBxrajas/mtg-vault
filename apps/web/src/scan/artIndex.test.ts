import { encodeArtIndex } from "@mtg-vault/shared";
import { describe, expect, it, vi } from "vitest";
import { loadArtIndex, MAX_AGE_MS, type IndexStore } from "./artIndex";

const ID = "00000000-0000-4000-8000-000000000001";
const file = encodeArtIndex([{ illustrationId: ID, oracleId: ID, hash: new Uint8Array(32) }]);
const memory = (initial: { bytes: Uint8Array; savedAt: number } | null = null) => {
  const store: IndexStore & { saved: { bytes: Uint8Array; savedAt: number } | null } = {
    saved: initial,
    get: async () => store.saved,
    set: async (bytes, savedAt) => void (store.saved = { bytes, savedAt }),
  };
  return store;
};

describe("loadArtIndex", () => {
  it("downloads the index, keeps a copy and reports progress", async () => {
    const store = memory();
    const progress: (number | null)[] = [];
    const fetchFn = vi.fn(async () => new Response(file as unknown as BodyInit, { headers: { "content-length": String(file.length) } }));
    const { index, fromCache } = await loadArtIndex({ store, fetchFn, now: () => 1000, onProgress: (p) => progress.push(p) });
    expect(index).toHaveLength(1);
    expect(fromCache).toBe(false);
    expect(store.saved?.savedAt).toBe(1000);
    expect(progress.at(-1)).toBe(1);
    expect(progress.every((p) => p === null || (p >= 0 && p <= 1))).toBe(true);
  });

  it("uses a recent copy without downloading", async () => {
    const store = memory({ bytes: file, savedAt: 1000 });
    const fetchFn = vi.fn();
    const result = await loadArtIndex({ store, fetchFn, now: () => 1000 + MAX_AGE_MS - 1 });
    expect(result.fromCache).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("downloads again when the copy is old, or damaged", async () => {
    const fetchFn = vi.fn(async () => new Response(file as unknown as BodyInit));
    await loadArtIndex({ store: memory({ bytes: file, savedAt: 0 }), fetchFn, now: () => MAX_AGE_MS + 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await loadArtIndex({ store: memory({ bytes: new Uint8Array(5), savedAt: 1000 }), fetchFn, now: () => 1001 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("falls back to an old copy when the download fails", async () => {
    const store = memory({ bytes: file, savedAt: 0 });
    const result = await loadArtIndex({ store, fetchFn: vi.fn(async () => new Response("", { status: 502 })), now: () => MAX_AGE_MS * 2 });
    expect(result.fromCache).toBe(true);
  });

  it("explains an index that is not published yet, and a failure with no copy", async () => {
    await expect(loadArtIndex({ store: memory(), fetchFn: vi.fn(async () => new Response("", { status: 503 })) })).rejects.toThrow(/not been published/);
    await expect(loadArtIndex({ store: memory(), fetchFn: vi.fn(async () => new Response("", { status: 500 })) })).rejects.toThrow(/\(500\)/);
  });

  it("rejects a download that is not an index", async () => {
    await expect(loadArtIndex({ store: memory(), fetchFn: vi.fn(async () => new Response(new Uint8Array(30) as unknown as BodyInit)) })).rejects.toThrow(/Not an art index/);
  });
});
