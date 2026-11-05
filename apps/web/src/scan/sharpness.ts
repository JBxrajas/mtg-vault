import { hammingDistance, isBlankHash } from "@mtg-vault/shared";

/**
 * How well focused a frame is, from the variance of its Laplacian (the sum of the second differences
 * of the grey pixels): a sharp picture has strong edges, a blurred one is smooth. The limits come from
 * four phone photos of cards at 160×224 (variance 480–2100 on slightly blurry to sharp photos) and are
 * provisional; adjust them with `FOCUS_LOW` / `FOCUS_HIGH` after trying real cameras.
 */

/** `log10(variance + 1)` that counts as fully out of focus and as in focus. */
export const FOCUS_LOW = 1;
export const FOCUS_HIGH = 3;
/** Level from which the guide is green and a capture is allowed to start by itself. */
export const FOCUS_OK = 0.85;

/** Variance of the Laplacian of grey pixels (row by row). */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3 || gray.length !== width * height) return 0;
  let sum = 0;
  let sumSquares = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - width]! - gray[i + width]!;
      sum += v;
      sumSquares += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return Math.max(0, sumSquares / n - mean * mean);
}

/** 0 (blurred) to 1 (sharp). */
export function focusLevel(variance: number): number {
  const level = (Math.log10(variance + 1) - FOCUS_LOW) / (FOCUS_HIGH - FOCUS_LOW);
  return Math.max(0, Math.min(1, level));
}

/** Grey pixels of an RGBA picture, same luma as the fingerprint. */
export function grayFromRgba(rgba: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(Math.floor(rgba.length / 4));
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  return out;
}

/** Colour of the guide for a focus level: red at 0, through yellow, to green at 1. */
export function focusColor(level: number): string {
  return `hsl(${Math.round(Math.max(0, Math.min(1, level)) * 120)} 85% 50%)`;
}

/** Level from which a picture that holds still is sharp enough to be taken by itself (the guide is green from `FOCUS_OK`). */
export const FOCUS_TAKE = 0.6;
/** Bits that may differ between two readings of a card that is held still (camera noise, a shaking hand). */
export const STEADY_DISTANCE = 28;
/** Bits that must differ from the last card taken for the view to count as another card, or as the card taken away. */
export const NEW_CARD_DISTANCE = 64;

/** One look at the guide: how sharp it is and the fingerprint of the art inside it. */
export interface Reading {
  level: number;
  hash: Uint8Array;
}

/**
 * Decides when to capture by itself, so cards can be shown one after another without touching the phone.
 * A picture is taken when the view holds still (the fingerprint barely changes between readings) and is
 * sharp enough, `needed` readings in a row. The card is not taken again while the view stays the same as the
 * last one taken; once the view differs a lot from it (another card, or the card taken away) it arms again.
 * It does not depend on the focus dropping between cards, which a textured table never does.
 */
export class AutoCapture {
  private run = 0;
  private armed = true;
  private previous: Uint8Array | null = null;
  private taken: Uint8Array | null = null;
  constructor(private readonly needed = 3) {}

  /** Feed one reading; true means capture now. */
  update({ level, hash }: Reading): boolean {
    const steady = this.previous !== null && hammingDistance(this.previous, hash) <= STEADY_DISTANCE;
    this.previous = hash;
    if (this.taken && hammingDistance(this.taken, hash) > NEW_CARD_DISTANCE) this.armed = true;
    if (!this.armed || isBlankHash(hash) || !steady || level < FOCUS_TAKE) {
      this.run = 0;
      return false;
    }
    this.run++;
    if (this.run < this.needed) return false;
    this.armed = false;
    this.run = 0;
    this.taken = hash;
    return true;
  }

  /** Allow another capture of the view as it is (the user pressed the button, or the last one was not recognised). */
  rearm() {
    this.armed = true;
    this.run = 0;
    this.taken = null;
  }
}
