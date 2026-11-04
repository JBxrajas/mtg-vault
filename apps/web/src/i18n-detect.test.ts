// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The starting language is decided when the module loads, so each case imports it fresh. */
async function load(languages: string[], saved?: string) {
  vi.resetModules();
  localStorage.clear();
  if (saved) localStorage.setItem("mtg-vault.locale", saved);
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
  return (await import("./i18n")).getLocale();
}

beforeEach(() => vi.restoreAllMocks());

describe("starting language", () => {
  it("follows the browser when it prefers Spanish", async () => {
    expect(await load(["es-MX", "en"])).toBe("es");
  });
  it("uses the first language we have, skipping ones we do not", async () => {
    expect(await load(["fr-FR", "es-ES", "en"])).toBe("es");
  });
  it("falls back to English", async () => {
    expect(await load(["fr-FR", "de"])).toBe("en");
  });
  it("prefers what the user saved over the browser", async () => {
    expect(await load(["es-ES"], "en")).toBe("en");
    expect(await load(["en-US"], "es")).toBe("es");
  });
  it("ignores a saved value that is not a language we have", async () => {
    expect(await load(["en-US"], "klingon")).toBe("en");
  });
});
