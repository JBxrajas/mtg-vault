import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToken } from "./auth.js";
import { addToCollection, fetchCollection, importCollection, removeFromCollection, updateCollectionItem } from "./collectionApi.js";

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
const lastCall = (fn: ReturnType<typeof vi.fn>) => {
  const [url, init] = fn.mock.calls.at(-1)! as [URL, RequestInit];
  return { url: url.toString(), init };
};

describe("collection API client", () => {
  it("refuses to call the API without a session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCollection()).rejects.toThrow("Sign in");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists items with the Bearer token", async () => {
    setToken("tok");
    const fetchMock = vi.fn().mockResolvedValue(json(200, { items: [{ id: "i1" }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchCollection()).toEqual([{ id: "i1" }]);
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/\/collection\/items$/);
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("adds, updates and removes with the right method, path and body", async () => {
    setToken("tok");
    const fetchMock = vi.fn().mockImplementation(async () => json(200, { item: { id: "i1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await addToCollection({ printingId: "p1", quantity: 2, finish: "foil" });
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({ printingId: "p1", quantity: 2, finish: "foil" });

    await updateCollectionItem("i1", { quantity: 3 });
    expect(lastCall(fetchMock).init.method).toBe("PATCH");
    expect(lastCall(fetchMock).url).toMatch(/\/collection\/items\/i1$/);

    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    await removeFromCollection("i1");
    expect(lastCall(fetchMock).init.method).toBe("DELETE");
  });

  it("surfaces the server's error message", async () => {
    setToken("tok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, { error: "2 copies are placed in binders" })));
    await expect(updateCollectionItem("i1", { quantity: 1 })).rejects.toThrow("2 copies are placed in binders");
  });
});

describe("importCollection", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ line: i + 2, name: `Card ${i}`, count: 1 }));
  const report = (over = {}) => ({ created: 0, updated: 0, unchanged: 0, adjusted: [], problems: [], ...over });

  it("sends the rows in chunks of 500, in order, and adds the reports up", async () => {
    setToken("tok");
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => json(200, report({ created: 500, adjusted: [{ line: 2, name: "a", reason: "r" }] })))
      .mockImplementationOnce(async () => json(200, report({ created: 400, unchanged: 100, problems: [{ line: 600, name: "b", reason: "x" }] })))
      .mockImplementationOnce(async () => json(200, report({ updated: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const progress: [number, number][] = [];

    const result = await importCollection(rows(1200), (done, total) => progress.push([done, total]));

    const sent = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).rows as { line: number }[]);
    expect(sent.map((r) => r.length)).toEqual([500, 500, 200]);
    expect(sent[0]![0]!.line).toBe(2);
    expect(sent[2]!.at(-1)!.line).toBe(1201);
    expect((fetchMock.mock.calls[0]![0] as URL).toString()).toMatch(/\/collection\/import$/);
    expect(progress).toEqual([[500, 1200], [1000, 1200], [1200, 1200]]);
    expect(result).toMatchObject({ created: 900, updated: 200, unchanged: 100 });
    expect(result.adjusted).toHaveLength(1);
    expect(result.problems).toHaveLength(1);
  });

  it("makes one request for a small file", async () => {
    setToken("tok");
    const fetchMock = vi.fn().mockImplementation(async () => json(200, report({ created: 3 })));
    vi.stubGlobal("fetch", fetchMock);
    expect((await importCollection(rows(3))).created).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops at the first failing request and keeps the server's message", async () => {
    setToken("tok");
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => json(200, report({ created: 500 })))
      .mockImplementationOnce(async () => json(500, { error: "Internal server error" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(importCollection(rows(1500))).rejects.toThrow("Internal server error");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not call the API without a session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(importCollection(rows(1))).rejects.toThrow("Sign in");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
