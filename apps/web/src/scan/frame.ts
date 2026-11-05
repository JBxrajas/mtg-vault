/** Geometry of the guide frame and of the art inside a card. Fractions are of the card's width / height. */

/** A card is 63 × 88 mm. */
export const CARD_ASPECT = 63 / 88;

/** Where the art sits on a modern card (the part Scryfall's `art_crop` shows). */
export const ART_BOX = { x: 0.0735, y: 0.1177, w: 0.853, h: 0.45 } as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The card-shaped guide, centred in a picture, as fractions of the picture's width and height.
 * It takes up to 82% of the height and 90% of the width, whichever is smaller.
 */
export function guideRect(pictureW: number, pictureH: number): Rect {
  let h = pictureH * 0.82;
  let w = h * CARD_ASPECT;
  if (w > pictureW * 0.9) {
    w = pictureW * 0.9;
    h = w / CARD_ASPECT;
  }
  return { x: (1 - w / pictureW) / 2, y: (1 - h / pictureH) / 2, w: w / pictureW, h: h / pictureH };
}

/** A rectangle inside another one, both as fractions of the same picture: `inner` is given as fractions of `outer`. */
export function within(outer: Rect, inner: Rect): Rect {
  return { x: outer.x + inner.x * outer.w, y: outer.y + inner.y * outer.h, w: inner.w * outer.w, h: inner.h * outer.h };
}

/** Fractions of a picture to pixels, rounded, never empty and never outside the picture. */
export function toPixels(r: Rect, pictureW: number, pictureH: number): Rect {
  const x = Math.max(0, Math.min(pictureW - 1, Math.round(r.x * pictureW)));
  const y = Math.max(0, Math.min(pictureH - 1, Math.round(r.y * pictureH)));
  return { x, y, w: Math.max(1, Math.min(pictureW - x, Math.round(r.w * pictureW))), h: Math.max(1, Math.min(pictureH - y, Math.round(r.h * pictureH))) };
}

/** The art of a card whose picture fills the guide. */
export function artRegion(pictureW: number, pictureH: number, guide: Rect = guideRect(pictureW, pictureH)): Rect {
  return toPixels(within(guide, ART_BOX), pictureW, pictureH);
}
