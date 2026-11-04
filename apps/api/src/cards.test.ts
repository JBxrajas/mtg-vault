import { describe, expect, it } from "vitest";
import { likeEscape } from "./cards.js";

describe("likeEscape", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(likeEscape("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(likeEscape("Lightning Bolt")).toBe("Lightning Bolt");
  });
});
