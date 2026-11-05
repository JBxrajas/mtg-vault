import { describe, expect, it } from "vitest";
import {
  artHash,
  grayGridFromRgba,
  decodeArtIndex,
  encodeArtIndex,
  hammingDistance,
  HASH_BYTES,
  matchConfidence,
  nearestArt,
  type ArtIndexEntry,
} from "./art-hash.js";

const W = 17;
const H = 16;
const gray = (f: (x: number, y: number) => number) => Array.from({ length: W * H }, (_, i) => f(i % W, Math.floor(i / W)));
const UUID = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const hashWith = (ones: number): Uint8Array => {
  const h = new Uint8Array(HASH_BYTES);
  for (let i = 0; i < ones; i++) h[i >> 3]! |= 1 << (i & 7);
  return h;
};
const entry = (n: number, ones: number, oracle = n): ArtIndexEntry => ({ illustrationId: UUID(n), oracleId: UUID(oracle), hash: hashWith(ones) });

describe("artHash", () => {
  it("is all ones when every pixel is darker than its right neighbour, all zeros when brighter", () => {
    expect(Array.from(artHash(gray((x) => x)))).toEqual(Array(32).fill(255));
    expect(Array.from(artHash(gray((x) => 100 - x)))).toEqual(Array(32).fill(0));
  });

  it("ignores overall brightness and contrast", () => {
    const base = gray((x, y) => (x * 7 + y * 13) % 50);
    expect(artHash(base.map((v) => v * 2 + 30))).toEqual(artHash(base));
  });

  it("rejects the wrong number of pixels", () => {
    expect(() => artHash([1, 2, 3])).toThrow(/Expected 272/);
  });
});

describe("hammingDistance", () => {
  it("counts differing bits", () => {
    expect(hammingDistance(hashWith(0), hashWith(0))).toBe(0);
    expect(hammingDistance(hashWith(0), hashWith(256))).toBe(256);
    expect(hammingDistance(hashWith(10), hashWith(13))).toBe(3);
  });
});

describe("art index file", () => {
  it("round-trips entries", () => {
    const entries = [entry(1, 5), entry(2, 200)];
    expect(decodeArtIndex(encodeArtIndex(entries))).toEqual(entries);
  });

  it("takes 64 bytes per entry plus a 9-byte header", () => {
    expect(encodeArtIndex([entry(1, 1), entry(2, 2), entry(3, 3)]).length).toBe(9 + 3 * 64);
    expect(decodeArtIndex(encodeArtIndex([]))).toEqual([]);
  });

  it("refuses files that are not an index, or are cut short", () => {
    expect(() => decodeArtIndex(new Uint8Array(20))).toThrow(/Not an art index/);
    const ok = encodeArtIndex([entry(1, 1)]);
    expect(() => decodeArtIndex(ok.subarray(0, ok.length - 1))).toThrow(/truncated/);
    const wrongVersion = ok.slice();
    wrongVersion[4] = 9;
    expect(() => decodeArtIndex(wrongVersion)).toThrow(/version 9/);
  });

  it("refuses ids that are not UUIDs", () => {
    expect(() => encodeArtIndex([{ ...entry(1, 1), oracleId: "nope" }])).toThrow(/Not a UUID/);
  });
});

describe("nearestArt", () => {
  const index = [entry(1, 0), entry(2, 40), entry(3, 90), entry(4, 200)];

  it("returns the closest entries, nearest first, up to the limit", () => {
    const found = nearestArt(index, hashWith(60), 2);
    expect(found.map((m) => m.entry.illustrationId)).toEqual([UUID(2), UUID(3)]);
    expect(found.map((m) => m.distance)).toEqual([20, 30]);
  });

  it("returns fewer when the index is small, and nothing for an empty index", () => {
    expect(nearestArt(index, hashWith(0), 10)).toHaveLength(4);
    expect(nearestArt([], hashWith(0))).toEqual([]);
  });
});

describe("matchConfidence", () => {
  const m = (distance: number, oracle: number) => ({ entry: entry(oracle, 0, oracle), distance });

  it("is sure when the best is close and the next card is far", () => {
    expect(matchConfidence([m(44, 1), m(95, 2)])).toBe("sure");
  });
  it("is maybe when the next card is almost as close, or the best is not that close", () => {
    expect(matchConfidence([m(60, 1), m(66, 2)])).toBe("maybe");
    expect(matchConfidence([m(90, 1), m(150, 2)])).toBe("maybe");
  });
  it("is none when nothing is close, or there is nothing", () => {
    expect(matchConfidence([m(120, 1)])).toBe("none");
    expect(matchConfidence([])).toBe("none");
  });
  it("does not count other illustrations of the same card as competition", () => {
    expect(matchConfidence([m(50, 1), { entry: entry(9, 0, 1), distance: 52 }, m(120, 2)])).toBe("sure");
  });
});

describe("grayGridFromRgba", () => {
  const solid = (w: number, h: number, r: number, g: number, b: number) =>
    Uint8Array.from({ length: w * h * 4 }, (_, i) => [r, g, b, 255][i % 4]!);

  it("uses the luma of the colour (green counts most)", () => {
    expect(grayGridFromRgba(solid(17, 16, 255, 0, 0), 17, 16)[0]).toBe(76);
    expect(grayGridFromRgba(solid(17, 16, 0, 255, 0), 17, 16)[0]).toBe(150);
    expect(grayGridFromRgba(solid(17, 16, 0, 0, 255), 17, 16)[0]).toBe(29);
  });

  it("averages each block, whatever the picture's size", () => {
    // 34×32: left half black, right half white => dark up to column 7, half-way in column 8 (it straddles the edge), bright from column 9.
    const w = 34, h = 32;
    const rgba = Uint8Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : Math.floor(i / 4) % w < w / 2 ? 0 : 255));
    const grid = grayGridFromRgba(rgba, w, h);
    expect(grid[0]).toBe(0);
    expect(grid[16]).toBe(255);
    expect(grid[7]).toBe(0);
    expect(grid[8]).toBe(128);
    expect(grid[9]).toBe(255);
  });

  it("works on a picture smaller than the grid", () => {
    expect(grayGridFromRgba(solid(2, 2, 10, 10, 10), 2, 2)).toHaveLength(17 * 16);
  });

  it("gives the same fingerprint for a picture and a copy twice as big", () => {
    const small = Uint8Array.from({ length: 17 * 16 * 4 }, (_, i) => (i % 4 === 3 ? 255 : ((i >> 2) * 37) % 251));
    const big = new Uint8Array(34 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 34; x++) big.set(small.subarray(((y >> 1) * 17 + (x >> 1)) * 4, ((y >> 1) * 17 + (x >> 1)) * 4 + 4), (y * 34 + x) * 4);
    expect(artHash(grayGridFromRgba(big, 34, 32))).toEqual(artHash(grayGridFromRgba(small, 17, 16)));
  });

  it("rejects a buffer that does not match the size", () => {
    expect(() => grayGridFromRgba(new Uint8Array(10), 17, 16)).toThrow(/Expected 17×16/);
    expect(() => grayGridFromRgba(new Uint8Array(0), 0, 0)).toThrow();
  });
});
