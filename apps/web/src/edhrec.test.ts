import { describe, expect, it, vi } from "vitest";
import { edhrecSlug, edhrecUrl, openSideWindow } from "./edhrec";

describe("edhrecSlug", () => {
  it("drops punctuation and joins the words with hyphens", () => {
    expect(edhrecSlug("Atraxa, Praetors' Voice")).toBe("atraxa-praetors-voice");
    expect(edhrecSlug("Yuriko, the Tiger’s Shadow")).toBe("yuriko-the-tigers-shadow");
  });

  it("removes accents and keeps only the front face of a double-faced card", () => {
    expect(edhrecSlug("Lim-Dûl the Necromancer")).toBe("lim-dul-the-necromancer");
    expect(edhrecSlug("Esika, God of the Tree // The Prismatic Bridge")).toBe("esika-god-of-the-tree");
  });
});

describe("edhrecUrl", () => {
  it("points at the commander's page on EDHREC", () => {
    expect(edhrecUrl("Atraxa, Praetors' Voice")).toBe("https://edhrec.com/commanders/atraxa-praetors-voice");
  });
});

describe("openSideWindow", () => {
  it("opens a small popup that gets no access to this window", () => {
    const open = vi.fn();
    openSideWindow("https://edhrec.com/commanders/x", open as unknown as typeof window.open);
    expect(open).toHaveBeenCalledWith("https://edhrec.com/commanders/x", "mtg-vault-side", expect.stringMatching(/popup.*noopener.*noreferrer/));
  });
});
