import { describe, expect, it } from "vitest";
import { artSources, illustrationIdsOf } from "./art-faces.js";

const ORACLE = "11111111-1111-4111-8111-111111111111";
const ILL_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ILL_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const url = (n: string) => `https://cards.scryfall.io/art_crop/front/${n}.jpg`;

describe("artSources", () => {
  it("takes the art of a single-faced card", () => {
    expect(artSources({ oracle_id: ORACLE, illustration_id: ILL_A, image_uris: { art_crop: url("a") } })).toEqual([
      { illustrationId: ILL_A, oracleId: ORACLE, url: url("a") },
    ]);
  });

  it("takes each face of a double-faced card, using the face's own art", () => {
    const sources = artSources({
      oracle_id: ORACLE,
      card_faces: [
        { illustration_id: ILL_A, image_uris: { art_crop: url("a") } },
        { illustration_id: ILL_B, image_uris: { art_crop: url("b") } },
      ],
    });
    expect(sources.map((s) => s.illustrationId)).toEqual([ILL_A, ILL_B]);
    expect(sources.every((s) => s.oracleId === ORACLE)).toBe(true);
  });

  it("reads the oracle id from the faces when the card has none", () => {
    const sources = artSources({ card_faces: [{ oracle_id: ORACLE, illustration_id: ILL_A, image_uris: { art_crop: url("a") } }] });
    expect(sources[0]?.oracleId).toBe(ORACLE);
  });

  it("counts a face that repeats the same illustration once", () => {
    const face = { illustration_id: ILL_A, image_uris: { art_crop: url("a") } };
    expect(artSources({ oracle_id: ORACLE, card_faces: [face, face] })).toHaveLength(1);
  });

  it("skips digital-only cards and missing or placeholder scans", () => {
    const base = { oracle_id: ORACLE, illustration_id: ILL_A, image_uris: { art_crop: url("a") } };
    expect(artSources({ ...base, digital: true })).toEqual([]);
    expect(artSources({ ...base, image_status: "missing" })).toEqual([]);
    expect(artSources({ ...base, image_status: "placeholder" })).toEqual([]);
    expect(artSources({ ...base, image_status: "lowres" })).toHaveLength(1);
  });

  it("skips cards without an oracle id, an illustration id or an art image", () => {
    expect(artSources({ illustration_id: ILL_A, image_uris: { art_crop: url("a") } })).toEqual([]);
    expect(artSources({ oracle_id: ORACLE, image_uris: { art_crop: url("a") } })).toEqual([]);
    expect(artSources({ oracle_id: ORACLE, illustration_id: ILL_A, image_uris: {} })).toEqual([]);
  });
});

describe("illustrationIdsOf", () => {
  it("lists the art of a printing's faces once each, or null when there is none", () => {
    expect(illustrationIdsOf({ illustration_id: ILL_A })).toEqual([ILL_A]);
    expect(illustrationIdsOf({ card_faces: [{ illustration_id: ILL_A }, { illustration_id: ILL_B }, { illustration_id: ILL_A }] })).toEqual([ILL_A, ILL_B]);
    expect(illustrationIdsOf({ card_faces: [{}] })).toBeNull();
    expect(illustrationIdsOf({})).toBeNull();
  });
});
