import { afterEach, describe, expect, it, vi } from "vitest";
import { hasFeature, userFeatures } from "./features.js";

afterEach(() => vi.unstubAllEnvs());

describe("features", () => {
  it("is off for everyone when the list is unset or empty", () => {
    vi.stubEnv("AUCTIONS_USERS", "");
    expect(hasFeature("auctions", { id: "u1", username: "alice" })).toBe(false);
    expect(userFeatures({ id: "u1", username: "alice" })).toEqual([]);
  });

  it("matches listed user ids or usernames, ignoring case and spaces", () => {
    vi.stubEnv("AUCTIONS_USERS", " U1 , Bob ");
    expect(hasFeature("auctions", { id: "u1", username: "alice" })).toBe(true);
    expect(hasFeature("auctions", { id: "u2", username: "bob" })).toBe(true);
    expect(hasFeature("auctions", { id: "u3", username: "carol" })).toBe(false);
    expect(hasFeature("auctions", { id: "u3", username: null })).toBe(false);
    expect(userFeatures({ id: "u2", username: "BOB" })).toEqual(["auctions"]);
  });
});
