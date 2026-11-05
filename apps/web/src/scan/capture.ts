import { artHash, grayGridFromRgba, isBlankHash, nearestArt, type ArtIndexEntry, type ArtMatch } from "@mtg-vault/shared";
import { artRegion, CARD_ASPECT, guideRect, type Rect } from "./frame";
import type { Frame } from "./search";
import { focusLevel, grayFromRgba, laplacianVariance } from "./sharpness";

export type Picture = CanvasImageSource & { width: number; height: number };
type Rotation = 0 | 90 | 270;

/** Wider than this is wasted work: the fingerprint is 17×16 blocks. */
const WORK_WIDTH = 544;

function canvasOf(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser cannot read pictures");
  return { canvas, ctx };
}

/** Fingerprint of `region` (in pixels) of a picture. */
export function hashRegion(picture: Picture, region: Rect): Uint8Array {
  const scale = Math.min(1, WORK_WIDTH / region.w);
  const w = Math.max(17, Math.round(region.w * scale));
  const h = Math.max(16, Math.round(region.h * scale));
  const { ctx } = canvasOf(w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(picture, region.x, region.y, region.w, region.h, 0, 0, w, h);
  return artHash(grayGridFromRgba(ctx.getImageData(0, 0, w, h).data, w, h));
}

/** Focus level (0 to 1) of the part of a live picture inside the guide. */
export function focusOf(video: HTMLVideoElement): number {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return 0;
  const g = guideRect(w, h);
  const { ctx } = canvasOf(160, 224);
  ctx.drawImage(video, g.x * w, g.y * h, g.w * w, g.h * h, 0, 0, 160, 224);
  return focusLevel(laplacianVariance(grayFromRgba(ctx.getImageData(0, 0, 160, 224).data), 160, 224));
}

/** The whole live picture, at most `maxWidth` wide, for the search around the guide. */
export function frameOf(video: HTMLVideoElement, maxWidth = 960): Frame {
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const w = Math.max(1, Math.round(video.videoWidth * scale));
  const h = Math.max(1, Math.round(video.videoHeight * scale));
  const { ctx } = canvasOf(w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

/** The art of the card inside the guide of a live picture. */
export function hashGuide(video: HTMLVideoElement): Uint8Array {
  return hashRegion(video, artRegion(video.videoWidth, video.videoHeight));
}

/** A picture turned a quarter turn, so a sideways photo can be read. */
function rotated(picture: Picture, rotation: Rotation): Picture {
  if (rotation === 0) return picture;
  const { canvas, ctx } = canvasOf(picture.height, picture.width);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(picture, -picture.width / 2, -picture.height / 2);
  return canvas;
}

/**
 * The best match for a photo whose framing is unknown: tries the card filling the picture, the card at
 * the size of the guide, and a smaller card, each as it is and turned a quarter turn either way, and keeps
 * the closest. It costs nine scans of the index (a few milliseconds each).
 */
export function matchPhoto(picture: Picture, index: ArtIndexEntry[]): ArtMatch[] {
  const framings = [1, 0.82, 0.62];
  let best: ArtMatch[] = [];
  for (const rotation of [0, 90, 270] as Rotation[]) {
    const turned = rotated(picture, rotation);
    for (const scale of framings) {
      // A card `scale` of the picture's height tall, centred; the whole picture when scale is 1.
      const cardW = scale === 1 ? 1 : Math.min(1, (scale * turned.height * CARD_ASPECT) / turned.width);
      const guide = { x: (1 - cardW) / 2, y: (1 - scale) / 2, w: cardW, h: scale };
      const hash = hashRegion(turned, artRegion(turned.width, turned.height, guide));
      if (isBlankHash(hash)) continue;
      const found = nearestArt(index, hash, 12);
      if (found[0] && (!best[0] || found[0].distance < best[0].distance)) best = found;
    }
  }
  return best;
}
