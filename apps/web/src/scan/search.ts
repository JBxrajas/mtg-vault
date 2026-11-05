import { artHash, grayGridFromRgba, isBlankHash, nearestArt, type ArtIndexEntry, type ArtMatch } from "@mtg-vault/shared";
import { ART_BOX, guideRect, toPixels, within, type Rect } from "./frame";

/** A decoded picture: RGBA bytes, row by row. */
export interface Frame {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/**
 * The fingerprint is a grid of fixed blocks, so a card a little off the guide (shifted, bigger, smaller)
 * gives a different fingerprint: in a simulation with 120 cards, 1.5 % of shift left 28 % recognised.
 * So a capture looks for the card around the guide: the guide as it is, then the card 10 % smaller and
 * bigger and shifted by steps, keeping the closest match.
 */
export const SEARCH = {
  scales: [1, 0.9, 1.1],
  steps: [0, -1, 1, -2, 2],
  stepX: 0.012,
  stepY: 0.016,
  /** A match this close, with a clear gap to the next card, ends the search early. */
  sureDistance: 40,
  sureGap: 20,
};

export function hashAt(frame: Frame, guide: Rect): Uint8Array | null {
  const region = toPixels(within(guide, ART_BOX), frame.width, frame.height);
  if (region.w < 17 || region.h < 16) return null;
  const out = new Uint8Array(region.w * region.h * 4);
  for (let y = 0; y < region.h; y++) {
    const from = ((region.y + y) * frame.width + region.x) * 4;
    for (let i = 0; i < region.w * 4; i++) out[y * region.w * 4 + i] = frame.data[from + i]!;
  }
  return artHash(grayGridFromRgba(out, region.w, region.h));
}

/** The closest matches for a card somewhere around the guide of `frame`, and how many positions were tried. */
export function searchAroundGuide(frame: Frame, index: ArtIndexEntry[], limit = 12): { matches: ArtMatch[]; tried: number } {
  const base = guideRect(frame.width, frame.height);
  let best: ArtMatch[] = [];
  let tried = 0;
  for (const scale of SEARCH.scales) {
    for (const dy of SEARCH.steps) {
      for (const dx of SEARCH.steps) {
        const w = base.w * scale;
        const h = base.h * scale;
        const guide = { x: base.x + base.w / 2 - w / 2 + dx * SEARCH.stepX, y: base.y + base.h / 2 - h / 2 + dy * SEARCH.stepY, w, h };
        const hash = hashAt(frame, guide);
        if (!hash || isBlankHash(hash)) continue;
        tried++;
        const found = nearestArt(index, hash, limit);
        if (found[0] && (!best[0] || found[0].distance < best[0].distance)) best = found;
        if (best[0] && best[0].distance <= SEARCH.sureDistance) {
          const other = best.find((m) => m.entry.oracleId !== best[0]!.entry.oracleId);
          if (!other || other.distance - best[0].distance >= SEARCH.sureGap) return { matches: best, tried };
        }
      }
    }
  }
  return { matches: best, tried };
}
