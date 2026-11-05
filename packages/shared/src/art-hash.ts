/**
 * Visual fingerprint of a card's art, used to recognise a card from a photo (ADR 0014).
 *
 * The fingerprint is a 256-bit difference hash: the art is shrunk to 17×16 grey pixels and each
 * bit says whether a pixel is darker than its right neighbour. It survives blur, glare and
 * different sizes, and it does not depend on the language printed on the card.
 *
 * This file is pure (no image decoding): the job that builds the index and the browser that reads
 * a photo each shrink the image their own way and hand the 17×16 grey pixels to `artHash`.
 */

export const HASH_WIDTH = 17;
export const HASH_HEIGHT = 16;
export const HASH_BYTES = 32;

/** 256 bits from 17×16 grey pixels, row by row. */
export function artHash(gray: ArrayLike<number>): Uint8Array {
  if (gray.length !== HASH_WIDTH * HASH_HEIGHT) {
    throw new Error(`Expected ${HASH_WIDTH * HASH_HEIGHT} grey pixels, got ${gray.length}`);
  }
  const hash = new Uint8Array(HASH_BYTES);
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_HEIGHT; x++) {
      const bit = y * HASH_HEIGHT + x;
      if (gray[y * HASH_WIDTH + x]! < gray[y * HASH_WIDTH + x + 1]!) hash[bit >> 3]! |= 1 << (bit & 7);
    }
  }
  return hash;
}

const POPCOUNT = Uint8Array.from({ length: 256 }, (_, n) => {
  let c = 0;
  for (let v = n; v; v >>= 1) c += v & 1;
  return c;
});

/** Number of bits that differ; 0 means identical, about 128 means unrelated. */
export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < HASH_BYTES; i++) d += POPCOUNT[a[i]! ^ b[i]!]!;
  return d;
}

/** One illustration: which card it belongs to, and its fingerprint. */
export interface ArtIndexEntry {
  illustrationId: string;
  oracleId: string;
  hash: Uint8Array;
}

// ---- Binary file: "MVAI", version, count, then 64 bytes per entry ----

const MAGIC = [0x4d, 0x56, 0x41, 0x49]; // "MVAI"
const VERSION = 1;
const HEADER = 9;
const ENTRY = 16 + 16 + HASH_BYTES;

const uuidToBytes = (id: string): Uint8Array => {
  const hex = id.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`Not a UUID: ${id}`);
  return Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
};
const bytesToUuid = (b: Uint8Array): string => {
  const h = Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export function encodeArtIndex(entries: ArtIndexEntry[]): Uint8Array {
  const out = new Uint8Array(HEADER + entries.length * ENTRY);
  out.set(MAGIC, 0);
  out[4] = VERSION;
  new DataView(out.buffer).setUint32(5, entries.length, true);
  entries.forEach((e, i) => {
    if (e.hash.length !== HASH_BYTES) throw new Error("Bad hash length");
    const at = HEADER + i * ENTRY;
    out.set(uuidToBytes(e.illustrationId), at);
    out.set(uuidToBytes(e.oracleId), at + 16);
    out.set(e.hash, at + 32);
  });
  return out;
}

export function decodeArtIndex(data: Uint8Array): ArtIndexEntry[] {
  if (data.length < HEADER || MAGIC.some((m, i) => data[i] !== m)) throw new Error("Not an art index file");
  if (data[4] !== VERSION) throw new Error(`Unsupported art index version ${data[4]}`);
  const count = new DataView(data.buffer, data.byteOffset).getUint32(5, true);
  if (data.length !== HEADER + count * ENTRY) throw new Error("Art index file is truncated or has extra data");
  return Array.from({ length: count }, (_, i) => {
    const at = HEADER + i * ENTRY;
    return {
      illustrationId: bytesToUuid(data.subarray(at, at + 16)),
      oracleId: bytesToUuid(data.subarray(at + 16, at + 32)),
      hash: data.slice(at + 32, at + ENTRY),
    };
  });
}

export interface ArtMatch {
  entry: ArtIndexEntry;
  distance: number;
}

/** The `limit` entries closest to `hash`, nearest first. A linear scan: ~75k entries take a few ms. */
export function nearestArt(index: ArtIndexEntry[], hash: Uint8Array, limit = 5): ArtMatch[] {
  const best: ArtMatch[] = [];
  for (const entry of index) {
    const distance = hammingDistance(hash, entry.hash);
    if (best.length === limit && distance >= best[limit - 1]!.distance) continue;
    let at = best.length;
    while (at > 0 && best[at - 1]!.distance > distance) at--;
    best.splice(at, 0, { entry, distance });
    if (best.length > limit) best.pop();
  }
  return best;
}

export type MatchConfidence = "sure" | "maybe" | "none";

/**
 * How far to trust the best match. The limits come from a first test on five blurry phone photos
 * against 305 cards (correct card at distance 44–73, runner-up at 95 or more); they are provisional
 * until measured on the full catalog.
 */
export function matchConfidence(matches: ArtMatch[]): MatchConfidence {
  const best = matches[0];
  if (!best || best.distance > 100) return "none";
  const second = matches.find((m) => m.entry.oracleId !== best.entry.oracleId);
  const gap = second ? second.distance - best.distance : Infinity;
  return best.distance <= 80 && gap >= 15 ? "sure" : "maybe";
}
