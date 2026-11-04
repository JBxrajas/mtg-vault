import { z } from "zod";
import { parseCsv } from "./csv.js";
import { conditionSchema, finishSchema, type Condition, type Finish } from "./primitives.js";

/** One line of an import file, normalized. */
export const importRowSchema = z.object({
  /** Line number in the file (the header is line 1), for error messages. */
  line: z.number().int().min(1),
  name: z.string().trim().min(1).max(200),
  count: z.number().int().min(1).max(9999),
  /** Set code, for example "lea". */
  setCode: z.string().trim().min(1).max(10).optional(),
  collectorNumber: z.string().trim().min(1).max(20).optional(),
  /** When the file carries Scryfall ids, they identify the printing exactly. */
  scryfallId: z.string().uuid().optional(),
  finish: finishSchema.default("nonfoil"),
  condition: conditionSchema.default("NM"),
  language: z.string().trim().min(2).max(5).default("en"),
  purchasePrice: z.number().nonnegative().max(1_000_000).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type ImportRow = z.infer<typeof importRowSchema>;
export type ImportRowInput = z.input<typeof importRowSchema>;

/** Rows per request; bigger files are split by the client. */
export const IMPORT_CHUNK = 500;

export const importRequestSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(1000),
});

export interface ImportProblem {
  line: number;
  name: string;
  reason: string;
}

export interface ImportResult {
  /** Stacks created. */
  created: number;
  /** Stacks whose quantity or details changed. */
  updated: number;
  /** Stacks already identical to the file. */
  unchanged: number;
  /** Lines that were imported with a change, for example a finish the printing does not have. */
  adjusted: ImportProblem[];
  /** Lines that could not be imported. */
  problems: ImportProblem[];
}

// ---------------------------------------------------------------------------
// Reading a collection export (Moxfield, and files with similar headers).
// ---------------------------------------------------------------------------

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header names (normalized) each field may appear under. */
const HEADER_ALIASES: Record<string, string[]> = {
  count: ["count", "quantity", "qty", "amount"],
  name: ["name", "cardname", "card"],
  setCode: ["edition", "set", "setcode", "expansion", "editioncode"],
  collectorNumber: ["collectornumber", "number", "cardnumber", "collectorsnumber"],
  scryfallId: ["scryfallid"],
  condition: ["condition", "cond"],
  language: ["language", "lang"],
  foil: ["foil", "finish", "printing", "isfoil"],
  price: ["purchaseprice", "price", "purchase"],
  tags: ["tags", "tag", "binder", "binders"],
  proxy: ["proxy", "isproxy"],
  tradelist: ["tradelistcount"],
};

const LANGUAGES: Record<string, string> = {
  english: "en", spanish: "es", french: "fr", german: "de", italian: "it", portuguese: "pt",
  japanese: "ja", korean: "ko", russian: "ru", simplifiedchinese: "zhs", traditionalchinese: "zht",
  chinesesimplified: "zhs", chinesetraditional: "zht", phyrexian: "ph", chinese: "zhs",
};

export function parseCondition(value: string): Condition | null {
  const v = value.toLowerCase().replace(/[^a-z]/g, "");
  if (v === "") return "NM";
  if (["nm", "nearmint", "mint", "m", "nmm"].includes(v)) return "NM";
  if (["lp", "sp", "lightlyplayed", "slightlyplayed", "excellent", "ex"].includes(v)) return "LP";
  if (["mp", "moderatelyplayed", "played", "goodplayed", "good", "gd"].includes(v)) return "MP";
  if (["hp", "heavilyplayed", "poor", "pl"].includes(v)) return v === "pl" ? "MP" : "HP";
  if (["dmg", "damaged", "d"].includes(v)) return "DMG";
  return null;
}

export function parseFinish(value: string): Finish | null {
  const v = value.toLowerCase().trim();
  if (["", "normal", "nonfoil", "non-foil", "no", "false", "0", "regular"].includes(v)) return "nonfoil";
  if (["foil", "yes", "true", "1", "x"].includes(v)) return "foil";
  if (v === "etched" || v === "foil etched") return "etched";
  return null;
}

/** Language name or code to the Scryfall code; null when it is not recognised. */
export function parseLanguage(value: string): string | null {
  const v = value.trim();
  if (v === "") return "en";
  const byName = LANGUAGES[v.toLowerCase().replace(/[^a-z]/g, "")];
  if (byName) return byName;
  return /^[a-z]{2,3}$/i.test(v) ? v.toLowerCase() : null;
}

export interface ParsedImport {
  rows: ImportRowInput[];
  /** Lines that could not be read, with the reason. */
  problems: ImportProblem[];
  /** Columns of the file that were used, as (field -> header). */
  columns: Record<string, string>;
  /** Headers of the file that were not used. */
  ignoredColumns: string[];
  /** Sum of `count` over `rows`. */
  totalCards: number;
  /** Lines skipped on purpose, for example proxies. */
  skipped: number;
}

/**
 * Reads a collection export (Moxfield's "Count, Name, Edition, Condition, Language, Foil,
 * Collector Number, Purchase Price, …", or any file whose headers match the aliases above, such
 * as ManaBox, which also carries Scryfall ids). Identical lines (same card, printing, finish,
 * condition and language) are added together so that re-reading a file with repeated lines does
 * not undercount. Proxies are skipped. Throws when there is no name or no count column.
 */
export function parseCollectionCsv(text: string): ParsedImport {
  const table = parseCsv(text);
  if (table.length === 0) throw new Error("The file is empty");
  const header = table[0]!;
  const index: Record<string, number> = {};
  const columns: Record<string, string> = {};
  const used = new Set<number>();
  header.forEach((h, i) => {
    const n = normalizeHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (index[field] === undefined && aliases.includes(n)) {
        index[field] = i;
        columns[field] = h;
        used.add(i);
        break;
      }
    }
  });
  if (index.name === undefined) throw new Error("No card name column found (expected a header such as \"Name\")");
  if (index.count === undefined) throw new Error("No count column found (expected a header such as \"Count\" or \"Quantity\")");

  const problems: ImportProblem[] = [];
  const merged = new Map<string, ImportRowInput>();
  let skipped = 0;
  const cell = (r: string[], field: string) => (index[field] === undefined ? "" : (r[index[field]!] ?? "").trim());

  for (let i = 1; i < table.length; i++) {
    const r = table[i]!;
    const line = i + 1;
    const name = cell(r, "name");
    const problem = (reason: string) => problems.push({ line, name: name || "(no name)", reason });

    if (!name) {
      problem("No card name");
      continue;
    }
    const proxy = cell(r, "proxy").toLowerCase();
    if (["true", "yes", "1", "x"].includes(proxy)) {
      skipped++;
      continue;
    }
    const countText = cell(r, "count");
    const count = Number(countText);
    if (!Number.isInteger(count) || count < 1) {
      problem(`Count "${countText}" is not a whole number of at least 1`);
      continue;
    }
    if (count > 9999) {
      problem("Count is above 9999");
      continue;
    }
    const finish = parseFinish(cell(r, "foil"));
    if (!finish) {
      problem(`Unknown foil value "${cell(r, "foil")}"`);
      continue;
    }
    const condition = parseCondition(cell(r, "condition"));
    if (!condition) {
      problem(`Unknown condition "${cell(r, "condition")}"`);
      continue;
    }
    const language = parseLanguage(cell(r, "language"));
    if (!language) {
      problem(`Unknown language "${cell(r, "language")}"`);
      continue;
    }
    const priceText = cell(r, "price").replace(/[^0-9.,-]/g, "").replace(",", ".");
    const price = priceText === "" ? undefined : Number(priceText);
    const scryfallId = cell(r, "scryfallId");

    const row: ImportRowInput = {
      line,
      name,
      count,
      finish,
      condition,
      language,
      ...(cell(r, "setCode") ? { setCode: cell(r, "setCode").toLowerCase() } : {}),
      ...(cell(r, "collectorNumber") ? { collectorNumber: cell(r, "collectorNumber") } : {}),
      ...(scryfallId ? { scryfallId } : {}),
      ...(price !== undefined && Number.isFinite(price) && price >= 0 ? { purchasePrice: price } : {}),
      ...(cell(r, "tags") ? { notes: cell(r, "tags").slice(0, 500) } : {}),
    };
    const parsed = importRowSchema.safeParse(row);
    if (!parsed.success) {
      problem(parsed.error.issues[0]?.message ?? "Invalid row");
      continue;
    }

    const key = [scryfallId || "", row.setCode ?? "", row.collectorNumber ?? "", name.toLowerCase(), finish, condition, language].join("|");
    const existing = merged.get(key);
    if (existing) {
      existing.count += count;
      if (existing.purchasePrice === undefined) existing.purchasePrice = row.purchasePrice;
    } else {
      merged.set(key, row);
    }
  }

  const rows = [...merged.values()];
  const tooMany = rows.filter((r) => r.count > 9999);
  for (const r of tooMany) problems.push({ line: r.line, name: r.name, reason: "Repeated lines add up to more than 9999 copies" });
  const okRows = rows.filter((r) => r.count <= 9999);

  return {
    rows: okRows,
    problems,
    columns,
    ignoredColumns: header.filter((_, i) => !used.has(i)),
    totalCards: okRows.reduce((n, r) => n + r.count, 0),
    skipped,
  };
}
