import { describe, expect, it } from "vitest";
import { toCollectionItem } from "./collection.js";

const row = {
  id: "i1",
  printing_id: "p1",
  oracle_id: "o1",
  name: "Lightning Bolt",
  type_line: "Instant",
  cmc: "1.0",
  color_identity: ["R"],
  set_code: "lea",
  set_name: "Limited Edition Alpha",
  collector_number: "161",
  rarity: "common",
  image_uris: { small: "s", normal: "n", art_crop: "a" },
  finish: "foil",
  condition: "LP",
  language: "en",
  quantity: "3",
  purchase_price: "2.50",
  acquired_on: "2026-11-04",
  notes: null,
  priced_on: "2026-11-04",
  usd: "630.00",
  usd_foil: "900.00",
  usd_etched: null,
  eur: null,
  eur_foil: null,
  tix: null,
};

describe("toCollectionItem", () => {
  it("maps columns, converts numbers and picks the price of the stack's finish", () => {
    expect(toCollectionItem(row)).toEqual({
      id: "i1",
      printingId: "p1",
      oracleId: "o1",
      name: "Lightning Bolt",
      typeLine: "Instant",
      cmc: 1,
      colorIdentity: ["R"],
      setCode: "lea",
      setName: "Limited Edition Alpha",
      collectorNumber: "161",
      rarity: "common",
      finish: "foil",
      condition: "LP",
      language: "en",
      quantity: 3,
      purchasePrice: 2.5,
      acquiredOn: "2026-11-04",
      notes: null,
      image: { small: "s", normal: "n", artCrop: "a" },
      unitPrice: 900,
      pricesOn: "2026-11-04",
    });
  });

  it("uses the nonfoil price for nonfoil and has no unit price for a finish without one", () => {
    expect(toCollectionItem({ ...row, finish: "nonfoil" }).unitPrice).toBe(630);
    expect(toCollectionItem({ ...row, finish: "etched" }).unitPrice).toBeNull();
  });

  it("has no unit price when no snapshot exists", () => {
    const item = toCollectionItem({ ...row, priced_on: null, usd: null, usd_foil: null });
    expect(item.unitPrice).toBeNull();
    expect(item.pricesOn).toBeNull();
  });
});
