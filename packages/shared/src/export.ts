import type { CollectionItem } from "./index.js";
import { toCsv } from "./csv.js";
import type { Condition } from "./primitives.js";

const CONDITION_NAME: Record<Condition, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

/** Language names as Moxfield writes them; a code we do not know is written as it is. */
const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
  zhs: "Chinese Simplified",
  zht: "Chinese Traditional",
  ph: "Phyrexian",
};

export const COLLECTION_CSV_HEADER = [
  "Count",
  "Name",
  "Edition",
  "Condition",
  "Language",
  "Foil",
  "Collector Number",
  "Scryfall ID",
  "Purchase Price",
];

/**
 * The collection as CSV in the layout the import reads (Moxfield's columns, plus the Scryfall id,
 * which identifies the printing exactly), so a file exported here imports back to the same stacks.
 */
export function collectionToCsv(items: CollectionItem[]): string {
  return toCsv([
    COLLECTION_CSV_HEADER,
    ...items.map((i) => [
      String(i.quantity),
      i.name,
      i.setCode,
      CONDITION_NAME[i.condition],
      LANGUAGE_NAME[i.language] ?? i.language,
      i.finish === "nonfoil" ? "" : i.finish,
      i.collectorNumber,
      i.printingId,
      i.purchasePrice == null ? "" : String(i.purchasePrice),
    ]),
  ]);
}
