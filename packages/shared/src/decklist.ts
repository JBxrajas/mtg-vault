import { z } from "zod";
import { deckBoardSchema, MAX_COPIES, type DeckBoard } from "./decks.js";
import type { ImportProblem } from "./import.js";

/** One card line of a deck list. */
export interface DeckListRow {
  /** Line number in the text (the first line is 1), for error messages. */
  line: number;
  name: string;
  quantity: number;
  board: DeckBoard;
}

export interface ParsedDeckList {
  rows: DeckListRow[];
  problems: ImportProblem[];
  /** Sum of `quantity` over `rows`. */
  totalCards: number;
}

const HEADERS: Record<string, DeckBoard> = {
  deck: "main",
  main: "main",
  mainboard: "main",
  commander: "commander",
  commanders: "commander",
  sideboard: "sideboard",
  side: "sideboard",
  companion: "sideboard",
  maybeboard: "maybeboard",
  maybe: "maybeboard",
  considering: "maybeboard",
};

const headerOf = (line: string): DeckBoard | undefined =>
  HEADERS[line.replace(/:$/, "").trim().toLowerCase()];

/** `(M10) 146` or `[M10]`, and the `*F*` foil marker some exports add, are not part of the name. */
const cleanName = (raw: string) =>
  raw
    .replace(/\s+\*[A-Za-z]\*\s*$/, "")
    .replace(/\s+[([]([A-Za-z0-9]{2,6})[)\]](\s+[A-Za-z0-9★-]+)?\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Reads a deck list as Moxfield, Arena, MTGO and most sites write it: `4 Lightning Bolt`, `4x Lightning Bolt`,
 * `4 Lightning Bolt (M10) 146`, a bare name for one copy, and `SB: 2 Pyroblast` for the sideboard. Sections start
 * with a line such as `Commander`, `Deck`, `Sideboard` or `Maybeboard` (a trailing colon is fine). When the text has
 * no such line, the first blank line after the cards starts the sideboard, as MTGO lists do. Lines starting with `//`
 * or `#` are comments. The set and collector number are dropped: a deck holds cards, not printings.
 */
export function parseDeckList(text: string): ParsedDeckList {
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/);
  const hasHeaders = lines.some((l) => headerOf(l) !== undefined);
  const rows: DeckListRow[] = [];
  const problems: ImportProblem[] = [];
  let board: DeckBoard = "main";
  let seenCard = false;
  let blankSwitched = false;

  lines.forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trim();
    if (text === "") {
      if (!hasHeaders && seenCard && !blankSwitched && board === "main") {
        board = "sideboard";
        blankSwitched = true;
      }
      return;
    }
    if (text.startsWith("//") || text.startsWith("#")) return;
    const header = headerOf(text);
    if (header) {
      board = header;
      return;
    }

    let rowBoard = board;
    let body = text;
    const sb = /^SB:\s*/i.exec(body);
    if (sb) {
      rowBoard = "sideboard";
      body = body.slice(sb[0].length);
    }
    const m = /^(\d+)\s*[xX]?\s+(.+)$/.exec(body);
    const quantity = m ? Number(m[1]) : 1;
    const name = cleanName(m ? m[2]! : body);
    if (name === "") {
      problems.push({ line, name: text, reason: "No card name" });
      return;
    }
    if (quantity < 1 || quantity > MAX_COPIES) {
      problems.push({ line, name, reason: `${quantity} copies; use 1 to ${MAX_COPIES}` });
      return;
    }
    seenCard = true;
    rows.push({ line, name, quantity, board: rowBoard });
  });

  return { rows, problems, totalCards: rows.reduce((n, r) => n + r.quantity, 0) };
}

/** Name for comparing cards: lower case, front face only, accents and extra spaces ignored. */
const sameName = (name: string) =>
  (name.split("//")[0] ?? name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Takes the commander out of a pasted list: a deck holds the commander once, on the commander board, so a list that
 * repeats it (in its main board, or as its own Commander section) must not add a second copy. Returns the remaining
 * rows and how many copies were left out.
 */
export function dropCommanderRows(rows: DeckListRow[], commanderNames: string[]): { rows: DeckListRow[]; skipped: number } {
  const names = new Set(commanderNames.map(sameName));
  let skipped = 0;
  const kept = rows.filter((r) => {
    if (!names.has(sameName(r.name))) return true;
    skipped += r.quantity;
    return false;
  });
  return { rows: kept, skipped };
}

const SECTIONS: { board: DeckBoard; title: string }[] = [
  { board: "commander", title: "Commander" },
  { board: "main", title: "Deck" },
  { board: "sideboard", title: "Sideboard" },
  { board: "maybeboard", title: "Maybeboard" },
];

/**
 * The deck as text, one `4 Lightning Bolt` line per card, with a header per board. The header is left out when the
 * main board is the only one. `parseDeckList` reads it back.
 */
export function formatDeckList(cards: { name: string; quantity: number; board: DeckBoard }[]): string {
  const used = SECTIONS.filter((s) => cards.some((c) => c.board === s.board));
  const blocks = used.map((s) => {
    const lines = cards.filter((c) => c.board === s.board).map((c) => `${c.quantity} ${c.name}`);
    return used.length > 1 ? [s.title, ...lines].join("\n") : lines.join("\n");
  });
  return blocks.join("\n\n");
}

/** A deck list sent to `POST /decks/:id/import`. */
export const deckImportRowSchema = z.object({
  line: z.number().int().min(1),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(MAX_COPIES),
  board: deckBoardSchema,
});
export type DeckImportRow = z.infer<typeof deckImportRowSchema>;

export const deckImportRequestSchema = z.object({
  rows: z.array(deckImportRowSchema).min(1).max(1000),
});

export interface DeckImportResult {
  created: number;
  updated: number;
  unchanged: number;
  problems: ImportProblem[];
}
