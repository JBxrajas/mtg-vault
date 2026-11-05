import { describe, expect, it } from "vitest";
import { AutoCapture, FOCUS_OK, focusColor, focusLevel, grayFromRgba, laplacianVariance } from "./sharpness";

const checker = (w: number, h: number, size: number) => Array.from({ length: w * h }, (_, i) => (((i % w) / size + Math.floor(i / w) / size) | 0) % 2 ? 255 : 0);
const flat = (w: number, h: number) => new Array(w * h).fill(128);

describe("laplacianVariance", () => {
  it("is zero for a flat picture and large for hard edges", () => {
    expect(laplacianVariance(flat(20, 20), 20, 20)).toBe(0);
    expect(laplacianVariance(checker(20, 20, 1), 20, 20)).toBeGreaterThan(10_000);
  });

  it("is lower for a blurred copy than for the sharp one", () => {
    const sharp = checker(40, 40, 4);
    const blurred = sharp.map((_, i) => {
      const x = i % 40, y = Math.floor(i / 40);
      let s = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < 40 && yy >= 0 && yy < 40) { s += sharp[yy * 40 + xx]!; n++; }
      }
      return s / n;
    });
    expect(laplacianVariance(blurred, 40, 40)).toBeLessThan(laplacianVariance(sharp, 40, 40) / 4);
  });

  it("returns 0 for pictures that are too small or the wrong size", () => {
    expect(laplacianVariance([1, 2], 2, 1)).toBe(0);
    expect(laplacianVariance([1, 2, 3], 5, 5)).toBe(0);
  });
});

describe("focusLevel", () => {
  it("runs from 0 to 1 and is clamped", () => {
    expect(focusLevel(0)).toBe(0);
    expect(focusLevel(5)).toBe(0);
    expect(focusLevel(1000)).toBeGreaterThan(0.9);
    expect(focusLevel(1e9)).toBe(1);
  });

  it("rates the measured phone photos as in focus or nearly", () => {
    expect(focusLevel(481)).toBeGreaterThan(0.8);
    expect(focusLevel(2111)).toBeGreaterThanOrEqual(1 - 0.01);
  });
});

describe("focusColor", () => {
  it("goes from red to green", () => {
    expect(focusColor(0)).toBe("hsl(0 85% 50%)");
    expect(focusColor(0.5)).toBe("hsl(60 85% 50%)");
    expect(focusColor(1)).toBe("hsl(120 85% 50%)");
    expect(focusColor(7)).toBe("hsl(120 85% 50%)");
  });
});

describe("grayFromRgba", () => {
  it("uses the same luma as the fingerprint", () => {
    expect(Array.from(grayFromRgba([255, 0, 0, 255, 0, 255, 0, 255]))).toEqual([76, 149]);
  });
});

describe("AutoCapture", () => {
  const sharp = FOCUS_OK + 0.05;
  /** A fingerprint with `ones` bits set from the start, so two of them differ by the gap between their counts. */
  const view = (ones: number, from = 0) => {
    const h = new Uint8Array(32);
    for (let i = 0; i < ones; i++) h[(from + i) >> 3]! |= 1 << ((from + i) & 7);
    return h;
  };
  const cardA = view(120);
  const cardB = view(120, 128); // the other half of the bits: far from A
  const reading = (hash: Uint8Array, level = sharp) => ({ level, hash });

  it("captures once the view has held still and sharp for enough readings, not before", () => {
    const auto = new AutoCapture(3);
    // The first reading has nothing to compare with, so it never counts.
    expect([auto.update(reading(cardA)), auto.update(reading(cardA)), auto.update(reading(cardA)), auto.update(reading(cardA))]).toEqual([false, false, false, true]);
  });

  it("does not take a view that is moving, or blurred, or flat", () => {
    const auto = new AutoCapture(2);
    for (const hash of [cardA, cardB, cardA, cardB, cardA]) expect(auto.update(reading(hash))).toBe(false);
    const blurred = new AutoCapture(2);
    for (let i = 0; i < 6; i++) expect(blurred.update(reading(cardA, 0.2))).toBe(false);
    const flatView = new AutoCapture(2);
    for (let i = 0; i < 6; i++) expect(flatView.update(reading(new Uint8Array(32)))).toBe(false);
  });

  it("accepts a hand that shakes a little", () => {
    const auto = new AutoCapture(2);
    const shaken = view(112); // 8 bits away from A
    expect([auto.update(reading(cardA)), auto.update(reading(shaken)), auto.update(reading(cardA))]).toEqual([false, false, true]);
  });

  it("does not take the same card twice while it stays in view", () => {
    const auto = new AutoCapture(2);
    auto.update(reading(cardA));
    auto.update(reading(cardA));
    expect(auto.update(reading(cardA))).toBe(true);
    for (let i = 0; i < 20; i++) expect(auto.update(reading(cardA))).toBe(false);
  });

  it("takes the next card straight away, without the view going blurred in between", () => {
    const auto = new AutoCapture(2);
    for (let i = 0; i < 3; i++) auto.update(reading(cardA));
    const results = [auto.update(reading(cardB)), auto.update(reading(cardB)), auto.update(reading(cardB))];
    expect(results).toEqual([false, false, true]);
  });

  it("takes a second copy of the same card once it was taken away and shown again", () => {
    const auto = new AutoCapture(2);
    for (let i = 0; i < 3; i++) auto.update(reading(cardA));
    auto.update(reading(cardB, 0.2)); // the table, out of focus
    const results = [auto.update(reading(cardA)), auto.update(reading(cardA)), auto.update(reading(cardA))];
    expect(results).toEqual([false, false, true]);
  });

  it("can be re-armed by hand", () => {
    const auto = new AutoCapture(1);
    auto.update(reading(cardA));
    expect(auto.update(reading(cardA))).toBe(true);
    auto.rearm();
    expect(auto.update(reading(cardA))).toBe(true);
  });
});
