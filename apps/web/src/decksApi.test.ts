import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToken } from "./auth.js";
import { addDeckCard, createDeck, deleteDeck, fetchDeck, fetchDecks, importDeck, setDeckCard, updateDeck } from "./decksApi.js";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const last = (fn: ReturnType<typeof vi.fn>) => {
  const [url, init] = fn.mock.calls.at(-1)! as [URL, RequestInit];
  return { url: url.toString(), init, body: init.body ? JSON.parse(init.body as string) : undefined };
};

describe("decks API client", () => {
  it("needs a session", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(fetchDecks()).rejects.toThrow("Sign in");
    expect(f).not.toHaveBeenCalled();
  });

  it("uses the right method, path and body for each operation", async () => {
    setToken("tok");
    const f = vi.fn().mockImplementation(async () => json(200, { decks: [], deck: { id: "d1" }, cards: [] }));
    vi.stubGlobal("fetch", f);

    await fetchDecks();
    expect(last(f)).toMatchObject({ init: { method: "GET" } });
    expect(last(f).url).toMatch(/\/decks$/);
    expect(last(f).init.headers).toMatchObject({ Authorization: "Bearer tok" });

    await createDeck({ name: "Elves", format: "commander" });
    expect(last(f).init.method).toBe("POST");
    expect(last(f).body).toEqual({ name: "Elves", format: "commander" });

    await fetchDeck("d1");
    expect(last(f).url).toMatch(/\/decks\/d1$/);

    await updateDeck("d1", { name: "New" });
    expect(last(f).init.method).toBe("PATCH");

    await addDeckCard("d1", { oracleId: "o1", quantity: 2, board: "sideboard" });
    expect(last(f).url).toMatch(/\/decks\/d1\/cards$/);
    expect(last(f).init.method).toBe("POST");
    expect(last(f).body).toEqual({ oracleId: "o1", quantity: 2, board: "sideboard" });

    await setDeckCard("d1", { oracleId: "o1", quantity: 0 });
    expect(last(f).init.method).toBe("PUT");
    expect(last(f).body).toEqual({ oracleId: "o1", quantity: 0 });

    f.mockImplementation(async () => new Response(null, { status: 204 }));
    await deleteDeck("d1");
    expect(last(f).init.method).toBe("DELETE");
  });

  it("surfaces the server's message", async () => {
    setToken("tok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { error: "Deck not found" })));
    await expect(fetchDeck("d1")).rejects.toThrow("Deck not found");
  });
});

describe("importDeck", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ line: i + 1, name: `Card ${i}`, quantity: 1, board: "main" as const }));
  const report = (over = {}) => ({ created: 0, updated: 0, unchanged: 0, problems: [], ...over });

  it("sends the rows in chunks of 500 to the deck, in order, and adds the reports up", async () => {
    setToken("tok");
    const f = vi
      .fn()
      .mockImplementationOnce(async () => json(200, report({ created: 500 })))
      .mockImplementationOnce(async () => json(200, report({ created: 100, unchanged: 400, problems: [{ line: 600, name: "x", reason: "No card found" }] })))
      .mockImplementationOnce(async () => json(200, report({ updated: 200 })));
    vi.stubGlobal("fetch", f);
    const progress: [number, number][] = [];

    const result = await importDeck("d1", rows(1200), (done, total) => progress.push([done, total]));

    const sent = f.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).rows as { line: number }[]);
    expect(sent.map((r) => r.length)).toEqual([500, 500, 200]);
    expect(sent[2]!.at(-1)!.line).toBe(1200);
    expect((f.mock.calls[0]![0] as URL).toString()).toMatch(/\/decks\/d1\/import$/);
    expect(((f.mock.calls[0]![1] as RequestInit).headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(progress).toEqual([[500, 1200], [1000, 1200], [1200, 1200]]);
    expect(result).toMatchObject({ created: 600, updated: 200, unchanged: 400 });
    expect(result.problems).toHaveLength(1);
  });

  it("stops at the first request that fails", async () => {
    setToken("tok");
    const f = vi
      .fn()
      .mockImplementationOnce(async () => json(200, report({ created: 500 })))
      .mockImplementationOnce(async () => json(404, { error: "Deck not found" }));
    vi.stubGlobal("fetch", f);
    await expect(importDeck("d1", rows(1200))).rejects.toThrow("Deck not found");
    expect(f).toHaveBeenCalledTimes(2);
  });
});
