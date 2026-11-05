import { describe, expect, it } from "vitest";
import { hammingDistance, type ArtIndexEntry } from "@mtg-vault/shared";
import { guideRect } from "./frame";
import { hashAt, searchAroundGuide, type Frame } from "./search";

const W = 320;
const H = 180;

/** A picture of blocky pseudo-random shades, shifted by (dx, dy) pixels and optionally scaled about its centre. */
function picture(seed: number, dx = 0, dy = 0, scale = 1): Frame {
  const data = new Uint8Array(W * H * 4);
  const noise = (x: number, y: number) => {
    let n = Math.imul(x * 73856093, 1) ^ Math.imul(y * 19349663, 1) ^ Math.imul(seed, 83492791);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) % 256;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.round((x - W / 2) / scale + W / 2 - dx);
      const sy = Math.round((y - H / 2) / scale + H / 2 - dy);
      const v = noise(Math.floor(sx / 6), Math.floor(sy / 6));
      data.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return { data, width: W, height: H };
}

const entryOf = (seed: number, id: string): ArtIndexEntry => ({ illustrationId: id, oracleId: id, hash: hashAt(picture(seed), guideRect(W, H))! });

describe("searchAroundGuide", () => {
  const index = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => entryOf(seed, `card-${seed}`));

  it("finds a card that sits exactly in the guide, with the first try", () => {
    const { matches, tried } = searchAroundGuide(picture(3), index);
    expect(matches[0]!.entry.oracleId).toBe("card-3");
    expect(matches[0]!.distance).toBe(0);
    expect(tried).toBe(1);
  });

  it("finds a card that is shifted or a different size, which a single try would miss", () => {
    for (const [dx, dy, scale] of [[4, 0, 1], [-4, 3, 1], [0, -6, 1], [0, 0, 1.1], [0, 0, 0.9]] as const) {
      const shot = picture(5, dx, dy, scale);
      const alone = hammingDistance(hashAt(shot, guideRect(W, H))!, index[4]!.hash);
      const { matches } = searchAroundGuide(shot, index);
      expect(matches[0]!.entry.oracleId).toBe("card-5");
      expect(matches[0]!.distance).toBeLessThan(alone);
    }
  });

  it("gives nothing for a flat picture", () => {
    const flat: Frame = { data: new Uint8Array(W * H * 4).fill(128), width: W, height: H };
    expect(searchAroundGuide(flat, index)).toEqual({ matches: [], tried: 0 });
  });
});
