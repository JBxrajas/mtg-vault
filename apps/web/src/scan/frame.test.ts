import { describe, expect, it } from "vitest";
import { ART_BOX, artRegion, CARD_ASPECT, guideRect, toPixels, within } from "./frame";

describe("guideRect", () => {
  it("fits a card-shaped frame in a portrait phone picture, limited by width", () => {
    const g = guideRect(1080, 1920);
    expect(g.w).toBeCloseTo(0.9, 5);
    expect((g.w * 1080) / (g.h * 1920)).toBeCloseTo(CARD_ASPECT, 5);
    expect(g.x).toBeCloseTo(0.05, 5);
  });

  it("is limited by height in a landscape picture", () => {
    const g = guideRect(1920, 1080);
    expect(g.h).toBeCloseTo(0.82, 5);
    expect((g.w * 1920) / (g.h * 1080)).toBeCloseTo(CARD_ASPECT, 5);
  });

  it("is centred", () => {
    const g = guideRect(1280, 720);
    expect(g.x + g.w / 2).toBeCloseTo(0.5, 5);
    expect(g.y + g.h / 2).toBeCloseTo(0.5, 5);
  });
});

describe("within and toPixels", () => {
  it("places an inner rectangle inside an outer one", () => {
    expect(within({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 })).toEqual({ x: 0.35, y: 0.4, w: 0.25, h: 0.2 });
  });

  it("rounds to pixels and stays inside the picture", () => {
    expect(toPixels({ x: 0.5, y: 0.5, w: 0.75, h: 0.75 }, 100, 100)).toEqual({ x: 50, y: 50, w: 50, h: 50 });
    expect(toPixels({ x: 1, y: 1, w: 0, h: 0 }, 100, 100)).toEqual({ x: 99, y: 99, w: 1, h: 1 });
  });
});

describe("artRegion", () => {
  it("is the art box of the card inside the guide", () => {
    const r = artRegion(1000, 1000, { x: 0, y: 0, w: 1, h: 1 });
    expect(r.x).toBe(Math.round(ART_BOX.x * 1000));
    expect(r.y).toBe(Math.round(ART_BOX.y * 1000));
    expect(r.w).toBe(Math.round(ART_BOX.w * 1000));
    expect(r.h).toBe(Math.round(ART_BOX.h * 1000));
  });

  it("lies inside the picture", () => {
    const r = artRegion(1080, 1920);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(1080);
    expect(r.y + r.h).toBeLessThanOrEqual(1920);
  });
});
