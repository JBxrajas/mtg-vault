import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authHeaders, errorMessage, fetchMe, getToken, login, logout, register, setToken } from "./auth.js";

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

const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe("token storage", () => {
  it("stores and clears the token", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => setToken("abc")).not.toThrow();
    expect(getToken()).toBeNull();
  });
});

describe("authHeaders / errorMessage", () => {
  it("builds the Bearer header only with a token", () => {
    expect(authHeaders("t")).toEqual({ Authorization: "Bearer t" });
    expect(authHeaders(null)).toEqual({});
  });

  it("reads error or message from the body and falls back", async () => {
    expect(await errorMessage(res(400, { error: "Taken" }))).toBe("Taken");
    expect(await errorMessage(res(401, { message: "Invalid" }))).toBe("Invalid");
    expect(await errorMessage(new Response("oops", { status: 502 }))).toBe("Request failed (502)");
  });
});

describe("register / login / logout", () => {
  it("keeps the token returned in set-auth-token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, {}, { "set-auth-token": "tok" })));
    await register({ username: "alice", password: "12345678" });
    expect(getToken()).toBe("tok");
  });

  it("throws the server message and stores nothing on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(401, { message: "Invalid username or password" })));
    await expect(login({ username: "alice", password: "x" })).rejects.toThrow("Invalid username or password");
    expect(getToken()).toBeNull();
  });

  it("fails when the server sends no session token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200)));
    await expect(login({ username: "alice", password: "x" })).rejects.toThrow("did not return a session");
  });

  it("logout clears the token and tells the server", async () => {
    setToken("tok");
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal("fetch", fetchMock);
    await logout();
    expect(getToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });
});

describe("fetchMe", () => {
  it("is null without a token and does not call the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchMe()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the user", async () => {
    setToken("tok");
    const user = { id: "u1", username: "alice", displayUsername: "Alice" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, { user })));
    expect(await fetchMe()).toEqual(user);
  });

  it("drops an expired token on 401", async () => {
    setToken("old");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(401, { error: "Not signed in" })));
    expect(await fetchMe()).toBeNull();
    expect(getToken()).toBeNull();
  });
});
