import { describe, expect, it } from "vitest";
import { likeEscape, toCardImage } from "./cards.js";

describe("likeEscape", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(likeEscape("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(likeEscape("Lightning Bolt")).toBe("Lightning Bolt");
  });
});

describe("toCardImage", () => {
  const uris = {
    small: "https://cards.example/small.jpg",
    normal: "https://cards.example/normal.jpg",
    large: "https://cards.example/large.jpg",
    art_crop: "https://cards.example/art.jpg",
  };

  it("keeps the sizes the clients use and renames art_crop", () => {
    expect(toCardImage(uris)).toEqual({
      small: uris.small,
      normal: uris.normal,
      artCrop: uris.art_crop,
    });
  });

  it.each([null, undefined, "x", 3, {}, { small: "a", normal: "b" }])("returns null for %j", (input) => {
    expect(toCardImage(input)).toBeNull();
  });
});
