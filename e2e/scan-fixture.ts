// Fingerprints for the scanner tests, made with the same code the app uses.
import { artHash, encodeArtIndex, grayGridFromRgba } from "../packages/shared/src/art-hash";

export { artHash, encodeArtIndex };

const ART = { x: 0.0735, y: 0.1177, w: 0.853, h: 0.45 };

/** Fingerprint of the art area of a picture that is the whole card (what the app takes for a photo that fills the frame). */
export function artHashRegionForTest(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const x0 = Math.round(ART.x * w);
  const y0 = Math.round(ART.y * h);
  const rw = Math.round(ART.w * w);
  const rh = Math.round(ART.h * h);
  const out = new Uint8Array(rw * rh * 4);
  for (let y = 0; y < rh; y++) out.set(rgba.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + rw) * 4), y * rw * 4);
  return artHash(grayGridFromRgba(out, rw, rh));
}
