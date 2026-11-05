import { cardCategory, type CardCategory } from "./decks.js";
import type { Color, CollectionItem } from "./index.js";
import type { Condition, Finish } from "./primitives.js";

/** `C` stands for colorless: a card with no color identity. */
export type ColorFilter = Color | "C";

export interface CollectionFilters {
  /** Words that must all appear in the card name, type, set, collector number or notes. */
  text: string;
  /** Any of these colors (or colorless). Empty means any. */
  colors: ColorFilter[];
  /** Card types, by the first one that applies (an Artifact Creature is a Creature). */
  types: CardCategory[];
  rarities: string[];
  /** Set codes. */
  sets: string[];
  finishes: Finish[];
  conditions: Condition[];
  mvMin: number | null;
  mvMax: number | null;
}

export const emptyFilters = (): CollectionFilters => ({
  text: "",
  colors: [],
  types: [],
  rarities: [],
  sets: [],
  finishes: [],
  conditions: [],
  mvMin: null,
  mvMax: null,
});

/** Lower case, without accents or extra spaces, so "Lim-Dûl" is found by "lim-dul". */
export const normalizeText = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const haystack = (i: CollectionItem) =>
  normalizeText([i.name, i.typeLine, i.setName, i.setCode, i.collectorNumber, i.notes ?? ""].join(" "));

/** How many filters are set (a text, or each facet with something chosen), for a badge and a "clear" button. */
export function activeFilterCount(f: CollectionFilters): number {
  return [
    f.text.trim() !== "",
    f.colors.length > 0,
    f.types.length > 0,
    f.rarities.length > 0,
    f.sets.length > 0,
    f.finishes.length > 0,
    f.conditions.length > 0,
    f.mvMin !== null,
    f.mvMax !== null,
  ].filter(Boolean).length;
}

/** The stacks that pass every filter. Inside one filter the choices are alternatives (red or blue); the filters add up. */
export function filterCollection(items: CollectionItem[], f: CollectionFilters): CollectionItem[] {
  const words = normalizeText(f.text).split(" ").filter(Boolean);
  return items.filter((i) => {
    if (words.length > 0) {
      const text = haystack(i);
      if (!words.every((w) => text.includes(w))) return false;
    }
    if (f.colors.length > 0) {
      const ok = i.colorIdentity.length === 0 ? f.colors.includes("C") : i.colorIdentity.some((c) => f.colors.includes(c));
      if (!ok) return false;
    }
    if (f.types.length > 0 && !f.types.includes(cardCategory(i.typeLine))) return false;
    if (f.rarities.length > 0 && !f.rarities.includes(i.rarity)) return false;
    if (f.sets.length > 0 && !f.sets.includes(i.setCode)) return false;
    if (f.finishes.length > 0 && !f.finishes.includes(i.finish)) return false;
    if (f.conditions.length > 0 && !f.conditions.includes(i.condition)) return false;
    if (f.mvMin !== null && i.cmc < f.mvMin) return false;
    if (f.mvMax !== null && i.cmc > f.mvMax) return false;
    return true;
  });
}

export type CollectionSort = "name" | "set" | "quantity" | "price" | "value" | "mv";

const value = (i: CollectionItem) => (i.unitPrice ?? 0) * i.quantity;

/**
 * A sorted copy. Ties fall back to the name so the order is stable; stacks without a price count as zero.
 * `desc` flips the order of the chosen key only.
 */
export function sortCollection(items: CollectionItem[], sort: CollectionSort, desc = false): CollectionItem[] {
  const key: Record<CollectionSort, (i: CollectionItem) => number | string> = {
    name: (i) => i.name.toLowerCase(),
    set: (i) => i.setName.toLowerCase(),
    quantity: (i) => i.quantity,
    price: (i) => i.unitPrice ?? 0,
    value,
    mv: (i) => i.cmc,
  };
  const dir = desc ? -1 : 1;
  return [...items].sort((a, b) => {
    const x = key[sort](a);
    const y = key[sort](b);
    const order = x < y ? -1 : x > y ? 1 : 0;
    return order * dir || a.name.localeCompare(b.name) || a.setName.localeCompare(b.setName);
  });
}

/** The sets present in a collection, for a filter menu: code, name and how many stacks, by name. */
export function setsIn(items: CollectionItem[]): { code: string; name: string; count: number }[] {
  const found = new Map<string, { code: string; name: string; count: number }>();
  for (const i of items) {
    const entry = found.get(i.setCode) ?? { code: i.setCode, name: i.setName, count: 0 };
    entry.count += 1;
    found.set(i.setCode, entry);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
