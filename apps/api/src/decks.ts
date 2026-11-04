import type {
  DeckBoard,
  DeckCard,
  DeckCardEntry,
  DeckCardSet,
  DeckDetail,
  DeckFormat,
  DeckImportResult,
  DeckImportRow,
  DeckInput,
  DeckSummary,
  DeckUpdate,
  ImportProblem,
} from "@mtg-vault/shared";
import { deckBoards, MAX_COPIES } from "@mtg-vault/shared";
import { sql } from "drizzle-orm";
import { likeEscape, toCardImage } from "./cards.js";
import { HttpError } from "./collection.js";
import { getDb } from "./db.js";

type Row = Record<string, unknown>;
const exec = (query: ReturnType<typeof sql>) => getDb().execute<Row>(query);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

export function toDeckSummary(r: Row): DeckSummary {
  return {
    id: r.id as string,
    name: r.name as string,
    format: r.format as DeckFormat,
    description: (r.description as string | null) ?? null,
    isPublic: Boolean(r.is_public),
    cardCount: Number(r.card_count ?? 0),
    updatedAt: iso(r.updated_at),
  };
}

export function toDeckCardEntry(r: Row): DeckCardEntry {
  return {
    oracleId: r.oracle_id as string,
    name: r.name as string,
    manaCost: (r.mana_cost as string | null) ?? null,
    typeLine: (r.type_line as string) ?? "",
    cmc: Number(r.cmc ?? 0),
    oracleText: (r.oracle_text as string | null) ?? null,
    colorIdentity: ((r.color_identity as string[] | null) ?? []) as DeckCardEntry["colorIdentity"],
    board: r.board as DeckCardEntry["board"],
    quantity: Number(r.quantity),
    printingId: (r.printing_id as string | null) ?? null,
    image: toCardImage(r.image_uris),
    owned: Number(r.owned ?? 0),
  };
}

const summarySelect = (where: ReturnType<typeof sql>) => sql`
  select d.id, d.name, d.format, d.description, d.is_public, d.updated_at,
         coalesce(sum(dc.quantity) filter (where dc.board in ('main', 'commander')), 0)::int as card_count
  from decks d
  left join deck_cards dc on dc.deck_id = d.id
  where ${where}
  group by d.id
`;

export async function listDecks(userId: string): Promise<DeckSummary[]> {
  const rows = await exec(sql`${summarySelect(sql`d.user_id = ${userId}`)} order by d.updated_at desc, d.name`);
  return rows.map(toDeckSummary);
}

async function getSummary(userId: string, id: string): Promise<DeckSummary | null> {
  const rows = await exec(summarySelect(sql`d.user_id = ${userId} and d.id = ${id}`));
  return rows[0] ? toDeckSummary(rows[0]) : null;
}

export async function createDeck(userId: string, input: DeckInput): Promise<DeckSummary> {
  const rows = await exec(sql`
    insert into decks (user_id, name, format, description, is_public)
    values (${userId}, ${input.name}, ${input.format}, ${input.description ?? null}, ${input.isPublic})
    returning id
  `);
  return (await getSummary(userId, rows[0]!.id as string))!;
}

/** The deck with its cards, each with the copies the user owns. Null when it is not this user's. */
export async function getDeck(userId: string, id: string): Promise<DeckDetail | null> {
  const deck = await getSummary(userId, id);
  if (!deck) return null;
  const rows = await exec(sql`
    select dc.oracle_id, dc.board, dc.quantity, dc.printing_id,
           c.name, c.mana_cost, c.type_line, c.cmc, c.oracle_text, c.color_identity,
           img.image_uris,
           coalesce((
             select sum(ci.quantity)
             from collection_items ci
             join collections col on col.id = ci.collection_id
             join printings p2 on p2.id = ci.printing_id
             where col.user_id = ${userId} and p2.oracle_id = dc.oracle_id
           ), 0)::int as owned
    from deck_cards dc
    join cards c on c.oracle_id = dc.oracle_id
    left join lateral (
      select p.image_uris
      from printings p
      where p.image_uris is not null
        and (p.id = dc.printing_id or (dc.printing_id is null and p.oracle_id = dc.oracle_id))
      order by (p.id = dc.printing_id) desc, p.released_at desc nulls last
      limit 1
    ) img on true
    where dc.deck_id = ${id}
    order by c.name
  `);
  return { deck, cards: rows.map(toDeckCardEntry) };
}

export async function updateDeck(userId: string, id: string, patch: DeckUpdate): Promise<DeckSummary | null> {
  const current = await getSummary(userId, id);
  if (!current) return null;
  await exec(sql`
    update decks set
      name = ${patch.name ?? current.name},
      format = ${patch.format ?? current.format},
      description = ${patch.description !== undefined ? patch.description : current.description},
      is_public = ${patch.isPublic ?? current.isPublic},
      updated_at = now()
    where id = ${id} and user_id = ${userId}
  `);
  return getSummary(userId, id);
}

/** Deletes the deck and its cards. False when it is not this user's. */
export async function deleteDeck(userId: string, id: string): Promise<boolean> {
  const rows = await exec(sql`delete from decks where id = ${id} and user_id = ${userId} returning id`);
  return rows.length > 0;
}

async function requireOwnDeck(userId: string, id: string) {
  const rows = await exec(sql`select 1 from decks where id = ${id} and user_id = ${userId}`);
  if (!rows[0]) throw new HttpError(404, "Deck not found");
}

async function requireCard(oracleId: string) {
  const rows = await exec(sql`select 1 from cards where oracle_id = ${oracleId}`);
  if (!rows[0]) throw new HttpError(404, "Card not found");
}

/** Adds copies of a card to a board; an existing entry grows. */
export async function addDeckCard(userId: string, deckId: string, card: DeckCard): Promise<void> {
  await requireOwnDeck(userId, deckId);
  await requireCard(card.oracleId);
  const rows = await exec(sql`
    insert into deck_cards (deck_id, oracle_id, board, quantity, printing_id)
    values (${deckId}, ${card.oracleId}, ${card.board}, ${card.quantity}, ${card.printingId ?? null})
    on conflict (deck_id, oracle_id, board) do update
      set quantity = deck_cards.quantity + excluded.quantity,
          printing_id = coalesce(excluded.printing_id, deck_cards.printing_id)
    where deck_cards.quantity + excluded.quantity <= ${MAX_COPIES}
    returning oracle_id
  `);
  if (!rows[0]) throw new HttpError(400, `A deck cannot hold more than ${MAX_COPIES} copies of a card`);
  await exec(sql`update decks set updated_at = now() where id = ${deckId}`);
}

/** Sets the copies of a card on a board; zero removes it. */
export async function setDeckCard(userId: string, deckId: string, card: DeckCardSet): Promise<void> {
  await requireOwnDeck(userId, deckId);
  if (card.quantity === 0) {
    await exec(sql`delete from deck_cards where deck_id = ${deckId} and oracle_id = ${card.oracleId} and board = ${card.board}`);
  } else {
    const updated = await exec(sql`
      update deck_cards set quantity = ${card.quantity}
      where deck_id = ${deckId} and oracle_id = ${card.oracleId} and board = ${card.board}
      returning oracle_id
    `);
    if (!updated[0]) throw new HttpError(404, "That card is not on this board; add it first");
  }
  await exec(sql`update decks set updated_at = now() where id = ${deckId}`);
}

export interface PlannedDeckCard {
  oracleId: string;
  board: DeckBoard;
  quantity: number;
}

/**
 * Decides what to write for a deck list. A card that was not found, a board the format does not have, and a total
 * above `MAX_COPIES` are problems; rows for the same card and board are added together. Pure: no database.
 */
export function planDeckImport(rows: DeckImportRow[], resolved: Map<number, string>, format: DeckFormat) {
  const allowed = new Set<DeckBoard>(["main", ...deckBoards(format)]);
  const problems: ImportProblem[] = [];
  const entries = new Map<string, PlannedDeckCard & { line: number; name: string }>();

  for (const row of rows) {
    const oracleId = resolved.get(row.line);
    if (!oracleId) {
      problems.push({ line: row.line, name: row.name, reason: "No card found" });
      continue;
    }
    if (!allowed.has(row.board)) {
      problems.push({
        line: row.line,
        name: row.name,
        reason: "The commander board is only for Commander, Brawl and Oathbreaker decks",
      });
      continue;
    }
    const key = `${oracleId}|${row.board}`;
    const existing = entries.get(key);
    if (existing) existing.quantity += row.quantity;
    else entries.set(key, { oracleId, board: row.board, quantity: row.quantity, line: row.line, name: row.name });
  }

  const ok: PlannedDeckCard[] = [];
  for (const e of entries.values()) {
    if (e.quantity > MAX_COPIES) {
      problems.push({ line: e.line, name: e.name, reason: `Lines for the same card add up to more than ${MAX_COPIES} copies` });
    } else {
      ok.push({ oracleId: e.oracleId, board: e.board, quantity: e.quantity });
    }
  }
  return { entries: ok, problems };
}

/** Oracle id for each row by card name (case-insensitive; the front face of "A // B" is enough), by line. */
async function resolveCardNames(rows: DeckImportRow[]): Promise<Map<number, string>> {
  const tuples = rows.map((r) => sql`(${r.line}::int, ${likeEscape(r.name)}::text)`);
  const found = await exec(sql`
    with input(line, name) as (values ${sql.join(tuples, sql`, `)})
    select i.line, c.oracle_id
    from input i
    join lateral (
      select oracle_id
      from cards
      where name ilike i.name or name ilike i.name || ' // %'
      order by (name ilike i.name) desc
      limit 1
    ) c on true
  `);
  return new Map(found.map((f) => [Number(f.line), f.oracle_id as string]));
}

/**
 * Imports a deck list into a deck. The count **sets** the copies of that card on that board, it is not added to what
 * is there, so importing the same list again changes nothing. Cards that are not in the list are left alone.
 */
export async function importDeckRows(userId: string, deckId: string, rows: DeckImportRow[]): Promise<DeckImportResult> {
  const deck = await getSummary(userId, deckId);
  if (!deck) throw new HttpError(404, "Deck not found");
  const { entries, problems } = planDeckImport(rows, await resolveCardNames(rows), deck.format);

  let created = 0;
  let updated = 0;
  if (entries.length > 0) {
    const tuples = entries.map((e) => sql`(${deckId}::uuid, ${e.oracleId}::uuid, ${e.board}, ${e.quantity}::int)`);
    const written = await exec(sql`
      insert into deck_cards (deck_id, oracle_id, board, quantity)
      values ${sql.join(tuples, sql`, `)}
      on conflict (deck_id, oracle_id, board) do update set quantity = excluded.quantity
        where deck_cards.quantity is distinct from excluded.quantity
      returning (xmax = 0) as inserted
    `);
    for (const w of written) w.inserted ? created++ : updated++;
    if (written.length > 0) await exec(sql`update decks set updated_at = now() where id = ${deckId}`);
  }
  return { created, updated, unchanged: entries.length - created - updated, problems };
}
