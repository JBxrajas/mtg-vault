import type { ImportProblem, ImportResult, ImportRow, Condition, Finish } from "@mtg-vault/shared";
import { sql } from "drizzle-orm";
import { likeEscape } from "./cards.js";
import { getDb } from "./db.js";

type Row = Record<string, unknown>;

/** How a row was matched to a printing, best first. */
export type Match = "id" | "set+number" | "set+name" | "name";

export interface Resolved {
  printingId: string;
  finishes: string[];
  match: Match;
  setCode: string;
  collectorNumber: string;
}

export interface Stack {
  printingId: string;
  finish: Finish;
  condition: Condition;
  language: string;
  quantity: number;
  purchasePrice: number | null;
  notes: string | null;
}

/**
 * Decides what to write. Rows without a printing are problems; a finish the printing does not
 * have is changed to one it has (and reported); a row matched less precisely than it asked for
 * (its set had no such number or card) is reported; rows that land on the same stack are added
 * together. Pure: no database.
 */
export function planImport(rows: ImportRow[], resolved: Map<number, Resolved>) {
  const problems: ImportProblem[] = [];
  const adjusted: ImportProblem[] = [];
  const stacks = new Map<string, Stack & { line: number; name: string }>();

  for (const row of rows) {
    const r = resolved.get(row.line);
    if (!r) {
      const where = row.setCode ? ` in ${row.setCode.toUpperCase()}${row.collectorNumber ? ` #${row.collectorNumber}` : ""}` : "";
      problems.push({ line: row.line, name: row.name, reason: `No card found${where}` });
      continue;
    }
    if (row.setCode && (r.match === "name" || (r.match === "set+name" && row.collectorNumber))) {
      adjusted.push({
        line: row.line,
        name: row.name,
        reason:
          r.match === "name"
            ? `Set ${row.setCode.toUpperCase()} has no such card; imported the printing ${r.setCode.toUpperCase()} #${r.collectorNumber}`
            : `No ${row.setCode.toUpperCase()} #${row.collectorNumber}; imported #${r.collectorNumber} of that set`,
      });
    }
    let finish = row.finish as Finish;
    if (!r.finishes.includes(finish)) {
      const fallback = (r.finishes[0] ?? "nonfoil") as Finish;
      adjusted.push({ line: row.line, name: row.name, reason: `This printing does not come in ${finish}; imported as ${fallback}` });
      finish = fallback;
    }
    const key = [r.printingId, finish, row.condition, row.language].join("|");
    const existing = stacks.get(key);
    if (existing) {
      existing.quantity += row.count;
      existing.purchasePrice ??= row.purchasePrice ?? null;
      existing.notes ??= row.notes ?? null;
    } else {
      stacks.set(key, {
        line: row.line,
        name: row.name,
        printingId: r.printingId,
        finish,
        condition: row.condition as Condition,
        language: row.language,
        quantity: row.count,
        purchasePrice: row.purchasePrice ?? null,
        notes: row.notes ?? null,
      });
    }
  }

  const ok: Stack[] = [];
  for (const s of stacks.values()) {
    if (s.quantity > 9999) {
      problems.push({ line: s.line, name: s.name, reason: "Lines that land on the same printing add up to more than 9999 copies" });
    } else {
      ok.push(s);
    }
  }
  return { stacks: ok, problems, adjusted };
}

const values = (rows: ReturnType<typeof sql>[]) => sql.join(rows, sql`, `);

const NAME_MATCH = sql`(c.name ilike i.name or c.name ilike i.name || ' // %')`;

/**
 * The ways to find a printing, best first. Every one but the id also requires the card name to
 * match, so a wrong number or set never imports a different card. `applies` says which rows can
 * use the step; `from` is the lateral query body (it sees the row as `i`).
 */
const STEPS: { match: Match; applies: (r: ImportRow) => boolean; from: ReturnType<typeof sql> }[] = [
  {
    match: "id",
    applies: (r) => !!r.scryfallId,
    from: sql`printings p join sets s on s.id = p.set_id where p.id = i.sid`,
  },
  {
    match: "set+number",
    applies: (r) => !!r.setCode && !!r.collectorNumber,
    from: sql`printings p join sets s on s.id = p.set_id join cards c on c.oracle_id = p.oracle_id
      where s.code = i.set_code and p.collector_number in (i.num, ltrim(i.num, '0')) and ${NAME_MATCH}`,
  },
  {
    match: "set+name",
    applies: (r) => !!r.setCode,
    from: sql`printings p join sets s on s.id = p.set_id join cards c on c.oracle_id = p.oracle_id
      where s.code = i.set_code and ${NAME_MATCH}`,
  },
  {
    match: "name",
    applies: () => true,
    from: sql`printings p join sets s on s.id = p.set_id join cards c on c.oracle_id = p.oracle_id
      where ${NAME_MATCH}`,
  },
];

/**
 * Finds the printing for each row in passes: the cheap exact ways first, and only the rows that
 * are still unresolved go on to the looser ones (a Moxfield file with set and number resolves
 * almost entirely in the second pass). Among several printings the English one and then the most
 * recent wins.
 */
async function resolveRows(rows: ImportRow[]): Promise<Map<number, Resolved>> {
  const resolved = new Map<number, Resolved>();
  for (const step of STEPS) {
    const pending = rows.filter((r) => !resolved.has(r.line) && step.applies(r));
    if (pending.length === 0) continue;
    const tuples = pending.map(
      (r) =>
        sql`(${r.line}::int, ${r.scryfallId ?? null}::uuid, ${r.setCode ?? null}::text, ${r.collectorNumber ?? null}::text, ${likeEscape(r.name)}::text)`,
    );
    const found = await getDb().execute<Row>(sql`
      with input(line, sid, set_code, num, name) as (values ${values(tuples)})
      select i.line, r.id, r.finishes, r.code, r.collector_number
      from input i
      join lateral (
        select p.id, p.finishes, s.code, p.collector_number
        from ${step.from}
        order by (p.lang <> 'en'), p.released_at desc nulls last
        limit 1
      ) r on true
    `);
    for (const f of found) {
      resolved.set(Number(f.line), {
        printingId: f.id as string,
        finishes: (f.finishes as string[]) ?? [],
        match: step.match,
        setCode: f.code as string,
        collectorNumber: f.collector_number as string,
      });
    }
  }
  return resolved;
}

/**
 * Imports collection rows. The count in the file **sets** the quantity of its stack, it is not
 * added to what is there, so importing the same file twice changes nothing the second time. Stacks
 * that are not in the file are left alone. A purchase price or note in the file replaces the stored
 * one; an empty one keeps it. A stack whose copies are placed in binders is not lowered below them.
 */
export async function importRows(collectionId: string, rows: ImportRow[]): Promise<ImportResult> {
  const resolved = await resolveRows(rows);
  const { stacks, problems, adjusted } = planImport(rows, resolved);

  let created = 0;
  let updated = 0;
  if (stacks.length > 0) {
    const tuples = stacks.map(
      (s) =>
        sql`(${collectionId}::uuid, ${s.printingId}::uuid, ${s.finish}, ${s.condition}, ${s.language}, ${s.quantity}::int, ${s.purchasePrice}::numeric, ${s.notes}::text)`,
    );
    const written = await getDb().execute<Row>(sql`
      insert into collection_items
        (collection_id, printing_id, finish, condition, language, quantity, purchase_price, notes)
      values ${values(tuples)}
      on conflict (collection_id, printing_id, finish, condition, language) do update
        set quantity = excluded.quantity,
            purchase_price = coalesce(excluded.purchase_price, collection_items.purchase_price),
            notes = coalesce(excluded.notes, collection_items.notes),
            updated_at = now()
        where (collection_items.quantity, collection_items.purchase_price, collection_items.notes)
              is distinct from (excluded.quantity,
                                coalesce(excluded.purchase_price, collection_items.purchase_price),
                                coalesce(excluded.notes, collection_items.notes))
          and excluded.quantity >= coalesce(
                (select sum(bi.quantity) from binder_items bi where bi.collection_item_id = collection_items.id), 0)
      returning (xmax = 0) as inserted
    `);
    for (const w of written) w.inserted ? created++ : updated++;
  }
  return { created, updated, unchanged: stacks.length - created - updated, adjusted, problems };
}
