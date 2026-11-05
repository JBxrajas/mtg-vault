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

  it("captures after enough steady readings in focus, not before", () => {
    const auto = new AutoCapture(3);
    expect([auto.update(sharp), auto.update(sharp), auto.update(sharp)]).toEqual([false, false, true]);
  });

  it("starts over when focus drops", () => {
    const auto = new AutoCapture(3);
    auto.update(sharp);
    auto.update(sharp);
    auto.update(0.5);
    expect([auto.update(sharp), auto.update(sharp), auto.update(sharp)]).toEqual([false, false, true]);
  });

  it("does not capture the same card twice, until the card is taken away", () => {
    const auto = new AutoCapture(2);
    auto.update(sharp);
    expect(auto.update(sharp)).toBe(true);
    for (let i = 0; i < 10; i++) expect(auto.update(sharp)).toBe(false);
    auto.update(0.1);
    auto.update(sharp);
    expect(auto.update(sharp)).toBe(true);
  });

  it("can be re-armed by hand", () => {
    const auto = new AutoCapture(1);
    expect(auto.update(sharp)).toBe(true);
    auto.rearm();
    expect(auto.update(sharp)).toBe(true);
  });
});
