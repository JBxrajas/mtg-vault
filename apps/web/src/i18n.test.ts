// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocale, resetLocale, setLocale, translate } from "./i18n";
import { en } from "./messages/en";
import { es } from "./messages/es";

const placeholders = (m: unknown) => {
  const texts = typeof m === "string" ? [m] : Object.values(m as Record<string, string>);
  return [...new Set(texts.flatMap((x) => [...x.matchAll(/\{(\w+)\}/g)].map((r) => r[1]!)))].sort();
};

describe("catalogs", () => {
  it("Spanish has exactly the keys of the English one", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it("each message keeps the same placeholders and the same plural shape in both languages", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
      expect(typeof es[key] === "string", key).toBe(typeof en[key] === "string");
    }
  });

  it("no message is empty", () => {
    for (const [key, m] of [...Object.entries(en), ...Object.entries(es)]) {
      const texts = typeof m === "string" ? [m] : Object.values(m);
      for (const text of texts) expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });
});

describe("translate", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(translate("en", "search.show", { name: "Sol Ring" })).toBe("Show Sol Ring");
    expect(translate("es", "search.show", { name: "Sol Ring" })).toBe("Ver Sol Ring");
    expect(translate("en", "search.show")).toBe("Show {name}");
  });

  it("picks singular or plural by count, in each language", () => {
    expect(translate("en", "collection.cards", { count: 1 })).toBe("card");
    expect(translate("en", "collection.cards", { count: 0 })).toBe("cards");
    expect(translate("es", "collection.cards", { count: 1 })).toBe("carta");
    expect(translate("es", "collection.cards", { count: 2 })).toBe("cartas");
    expect(translate("es", "import.button", { count: 1 })).toBe("Importar 1 línea");
    expect(translate("es", "import.button", { count: 3 })).toBe("Importar 3 líneas");
  });
});

describe("locale choice", () => {
  const languages = vi.spyOn(navigator, "languages", "get");

  beforeEach(() => localStorage.clear());
  afterEach(() => languages.mockReturnValue(["en-US"]));

  it("setLocale changes the language, the page's lang attribute and what is saved", () => {
    setLocale("es");
    expect(getLocale()).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem("mtg-vault.locale")).toBe("es");
    resetLocale();
    expect(getLocale()).toBe("en");
    expect(localStorage.getItem("mtg-vault.locale")).toBeNull();
  });

  it("still works when storage throws", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => setLocale("es")).not.toThrow();
      expect(getLocale()).toBe("es");
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
