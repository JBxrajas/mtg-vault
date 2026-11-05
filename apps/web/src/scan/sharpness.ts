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

/**
 * Decides when to capture by itself: the picture has to stay in focus for `needed` readings in a row,
 * and after a capture it must first lose focus (the card was taken away) before it arms again, so the
 * same card is not captured twice.
 */
export class AutoCapture {
  private run = 0;
  private armed = true;
  constructor(private readonly needed = 3) {}

  /** Feed one reading; true means capture now. */
  update(level: number): boolean {
    if (level < 0.3) {
      this.armed = true;
      this.run = 0;
      return false;
    }
    if (!this.armed) return false;
    this.run = level >= FOCUS_OK ? this.run + 1 : 0;
    if (this.run < this.needed) return false;
    this.armed = false;
    this.run = 0;
    return true;
  }

  /** Allow another capture without waiting for the card to be taken away (the user pressed the button). */
  rearm() {
    this.armed = true;
    this.run = 0;
  }
}
