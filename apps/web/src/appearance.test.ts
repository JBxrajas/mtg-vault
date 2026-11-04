// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  getAppearance,
  isArtUrl,
  parseAppearance,
  resetAppearance,
  setAppearance,
} from "./appearance";

const ART = "https://cards.scryfall.io/art_crop/front/b/d/bd8fa327.jpg?1706239968";

beforeEach(() => {
  localStorage.clear();
  resetAppearance();
});

describe("isArtUrl", () => {
  it("accepts Scryfall art and nothing else", () => {
    expect(isArtUrl(ART)).toBe(true);
    expect(isArtUrl("http://cards.scryfall.io/a.jpg")).toBe(false);
    expect(isArtUrl("https://evil.example/a.jpg")).toBe(false);
    expect(isArtUrl("https://cards.scryfall.io/a.jpg\") ; background: url(\"x")).toBe(false);
    expect(isArtUrl("https://cards.scryfall.io/a b.jpg")).toBe(false);
    expect(isArtUrl(42)).toBe(false);
  });
});

describe("parseAppearance", () => {
  it("falls back to the defaults for anything unusable", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("dark")).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({ mode: "neon", background: "pink", art: { url: "http://x", name: "a" }, dimming: "a" })).toEqual(
      DEFAULT_APPEARANCE,
    );
  });

  it("keeps the card id of the art only when it is a UUID", () => {
    const base = { url: ART, name: "Black Lotus" };
    const id = "5089ec1a-f881-4d55-af14-5d996171203b";
    expect(parseAppearance({ art: { ...base, oracleId: id } }).art).toEqual({ ...base, oracleId: id });
    expect(parseAppearance({ art: { ...base, oracleId: "x'); drop table" } }).art).toEqual(base);
    expect(parseAppearance({ art: { ...base, oracleId: 7 } }).art).toEqual(base);
  });

  it("keeps valid parts and clamps the dimming", () => {
    const a = parseAppearance({ mode: "dark", background: "blue", art: { url: ART, name: "Black Lotus" }, dimming: 5 });
    expect(a).toEqual({ mode: "dark", background: "blue", art: { url: ART, name: "Black Lotus" }, dimming: 50 });
    expect(parseAppearance({ dimming: 500 }).dimming).toBe(95);
  });
});

describe("applyAppearance", () => {
  it("sets mode, tint and art on the page, and removes them again", () => {
    const root = document.createElement("html");
    applyAppearance({ mode: "dark", background: "red", art: { url: ART, name: "x" }, dimming: 70 }, root);
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute("data-bg")).toBe("red");
    expect(root.hasAttribute("data-art")).toBe(true);
    expect(root.style.getPropertyValue("--art-url")).toBe(`url("${ART}")`);
    expect(root.style.getPropertyValue("--art-scrim")).toBe("0.7");

    applyAppearance(DEFAULT_APPEARANCE, root);
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.hasAttribute("data-art")).toBe(false);
    expect(root.style.getPropertyValue("--art-url")).toBe("");
  });
});

describe("setAppearance", () => {
  it("applies the choice, keeps it in storage and merges patches", () => {
    setAppearance({ mode: "light" });
    setAppearance({ background: "green" });
    expect(getAppearance()).toMatchObject({ mode: "light", background: "green" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(JSON.parse(localStorage.getItem("mtg-vault.appearance")!)).toMatchObject({ mode: "light", background: "green" });
  });

  it("ignores an invalid art URL instead of putting it in the page", () => {
    setAppearance({ art: { url: "https://evil.example/a.jpg", name: "x" } });
    expect(getAppearance().art).toBeNull();
    expect(document.documentElement.hasAttribute("data-art")).toBe(false);
  });

  it("still works when storage throws", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => setAppearance({ mode: "dark" })).not.toThrow();
      expect(getAppearance().mode).toBe("dark");
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
