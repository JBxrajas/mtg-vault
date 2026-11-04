import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToken } from "./auth.js";
import { addToCollection, fetchCollection, removeFromCollection, updateCollectionItem } from "./collectionApi.js";

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
