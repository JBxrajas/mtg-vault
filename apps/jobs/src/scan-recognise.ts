import { artHash, grayGridFromRgba, isBlankHash, matchConfidence, nearestArt, type ArtIndexEntry, type ArtMatch, type MatchConfidence } from "@mtg-vault/shared";
import { artRegion } from "../../web/src/scan/frame.js";
import { searchAroundGuide } from "../../web/src/scan/search.js";

export interface Found {
  cards: { oracleId: string; distance: number }[];
  confidence: MatchConfidence;
  gap?: number;
}
export type Recogniser = (rgba: Buffer, width: number, height: number, index: ArtIndexEntry[]) => Found;

/** The scanner as it is now: the art box of the guide, shrunk to 17×16 grey blocks, nearest in the index. */
export const recognise: Recogniser = (rgba, width, height, index) => {
  const region = artRegion(width, height);
  const out = new Uint8Array(region.w * region.h * 4);
  for (let y = 0; y < region.h; y++) {
    const from = ((region.y + y) * width + region.x) * 4;
    out.set(rgba.subarray(from, from + region.w * 4), y * region.w * 4);
  }
  const hash = artHash(grayGridFromRgba(out, region.w, region.h));
  if (isBlankHash(hash)) return { cards: [], confidence: "none" };
  const matches = nearestArt(index, hash, 12);
  const seen = new Set<string>();
  const cards: Found["cards"] = [];
  for (const m of matches) {
    if (seen.has(m.entry.oracleId)) continue;
    seen.add(m.entry.oracleId);
    cards.push({ oracleId: m.entry.oracleId, distance: m.distance });
  }
  return { cards, confidence: matchConfidence(matches) };
};


/** The scanner's search around the guide (`apps/web/src/scan/search.ts`), the same code the browser runs. */
export const recogniseSearch: Recogniser = (rgba, width, height, index) => {
  const { matches } = searchAroundGuide({ data: rgba, width, height }, index);
  const seen = new Set<string>();
  const cards: Found["cards"] = [];
  for (const m of matches) {
    if (seen.has(m.entry.oracleId)) continue;
    seen.add(m.entry.oracleId);
    cards.push({ oracleId: m.entry.oracleId, distance: m.distance });
  }
  return matches[0] ? { cards, confidence: matchConfidence(matches), gap: gapOf(matches) } : { cards: [], confidence: "none" };
};

function gapOf(matches: ArtMatch[]): number {
  const best = matches[0];
  const second = best && matches.find((m) => m.entry.oracleId !== best.entry.oracleId);
  return best && second ? second.distance - best.distance : 999;
}
