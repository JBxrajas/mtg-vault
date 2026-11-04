// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadText, safeFilename } from "./download";

afterEach(() => vi.restoreAllMocks());

describe("safeFilename", () => {
  it("removes characters that are not allowed in file names", () => {
    expect(safeFilename('Mono R/G: "Burn" <v2>?')).toBe("Mono R G Burn v2");
    expect(safeFilename("  a   b  ")).toBe("a b");
  });
  it("falls back when nothing is left, and keeps names short", () => {
    expect(safeFilename("///", "deck")).toBe("deck");
    expect(safeFilename("x".repeat(200))).toHaveLength(80);
  });
});

describe("downloadText", () => {
  it("offers the text as a file with the given name and type, then cleans up", async () => {
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => (blobs.push(b), "blob:fake"));
    const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("deck.txt");
      expect(this.href).toBe("blob:fake");
    });

    downloadText("deck.txt", "4 Lightning Bolt", "text/plain");

    expect(click).toHaveBeenCalledTimes(1);
    expect(blobs[0]!.type).toBe("text/plain;charset=utf-8");
    expect(await blobs[0]!.text()).toBe("4 Lightning Bolt");
    expect(document.querySelector("a[download]")).toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});
