import type { AuctionBid, AuctionStatus, AuctionUpdate } from "@mtg-vault/shared";
import { sql, type SQL } from "drizzle-orm";
import { toCardImage } from "./cards.js";
import { HttpError } from "./collection.js";
import { getDb } from "./db.js";

type Row = Record<string, unknown>;
const exec = (query: SQL) => getDb().execute<Row>(query);
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const str = (v: unknown): string | null => (v == null ? null : String(v));
const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

export function toAuctionBid(r: Row): AuctionBid {
  const image = toCardImage(r.image_uris);
  return {
    id: r.id as string,
    cardName: r.card_name as string,
    oracleId: str(r.oracle_id),
    printingId: str(r.printing_id),
    groupName: str(r.group_name),
    seller: str(r.seller),
    postUrl: str(r.post_url),
    myBid: num(r.my_bid),
    highBid: num(r.high_bid),
    highBidder: str(r.high_bidder),
    maxBid: num(r.max_bid),
    closesAt: iso(r.closes_at),
    status: r.status as AuctionStatus,
    pickupPlace: str(r.pickup_place),
    pickupAt: iso(r.pickup_at),
    deckId: str(r.deck_id),
    deckName: str(r.deck_name),
    image: image ? { small: image.small, normal: image.normal, artCrop: image.artCrop } : null,
    notes: str(r.notes),
    updatedAt: iso(r.updated_at) ?? "",
  };
}

const selectBids = (where: SQL) => sql`
  select b.*, d.name as deck_name, coalesce(p.image_uris, fp.image_uris) as image_uris
  from auction_bids b
  left join decks d on d.id = b.deck_id
  left join printings p on p.id = b.printing_id
  left join lateral (
    select image_uris from printings where oracle_id = b.oracle_id and b.printing_id is null
    order by released_at desc nulls last limit 1
  ) fp on true
  where ${where}
  order by b.closes_at asc nulls last, b.created_at
`;

export async function listBids(userId: string): Promise<AuctionBid[]> {
  return (await exec(selectBids(sql`b.user_id = ${userId}`))).map(toAuctionBid);
}

async function getBid(userId: string, id: string): Promise<AuctionBid | null> {
  const rows = await exec(selectBids(sql`b.user_id = ${userId} and b.id = ${id}`));
  return rows[0] ? toAuctionBid(rows[0]) : null;
}

/** Column for each field a client can set. */
const COLUMNS = {
  cardName: "card_name",
  oracleId: "oracle_id",
  printingId: "printing_id",
  groupName: "group_name",
  seller: "seller",
  postUrl: "post_url",
  myBid: "my_bid",
  highBid: "high_bid",
  highBidder: "high_bidder",
  maxBid: "max_bid",
  closesAt: "closes_at",
  status: "status",
  pickupPlace: "pickup_place",
  pickupAt: "pickup_at",
  deckId: "deck_id",
  notes: "notes",
} as const satisfies Record<keyof AuctionUpdate, string>;

/**
 * Checks the links to the catalog and to a deck, and fills the card from the printing.
 * A printing decides the card; a card without a printing is fine. The deck must be the user's own.
 */
export async function checkLinks(userId: string, fields: AuctionUpdate): Promise<AuctionUpdate> {
  const out = { ...fields };
  if (out.printingId) {
    const rows = await exec(sql`select oracle_id from printings where id = ${out.printingId}`);
    if (!rows[0]) throw new HttpError(400, "Printing not found");
    const oracle = rows[0].oracle_id as string;
    if (out.oracleId && out.oracleId !== oracle) throw new HttpError(400, "That printing is of another card");
    out.oracleId = oracle;
  } else if (out.oracleId) {
    const rows = await exec(sql`select 1 from cards where oracle_id = ${out.oracleId}`);
    if (!rows[0]) throw new HttpError(400, "Card not found");
  }
  // Another card without a printing: the old printing no longer applies.
  if (out.oracleId !== undefined && out.printingId === undefined) out.printingId = null;
  if (out.deckId) {
    const rows = await exec(sql`select 1 from decks where id = ${out.deckId} and user_id = ${userId}`);
    if (!rows[0]) throw new HttpError(404, "Deck not found");
  }
  return out;
}

const values = (fields: AuctionUpdate) =>
  (Object.keys(COLUMNS) as (keyof AuctionUpdate)[])
    .filter((k) => fields[k] !== undefined)
    .map((k) => ({ column: sql.identifier(COLUMNS[k]), value: fields[k] ?? null }));

export async function createBid(userId: string, input: AuctionUpdate & { cardName: string }): Promise<AuctionBid> {
  const fields = values(await checkLinks(userId, input));
  const rows = await exec(sql`
    insert into auction_bids (user_id, ${sql.join(fields.map((f) => f.column), sql`, `)})
    values (${userId}, ${sql.join(fields.map((f) => sql`${f.value}`), sql`, `)})
    returning id
  `);
  return (await getBid(userId, rows[0]!.id as string))!;
}

/** Null when the bid is not the user's. */
export async function updateBid(userId: string, id: string, patch: AuctionUpdate): Promise<AuctionBid | null> {
  const fields = values(await checkLinks(userId, patch));
  const rows = await exec(sql`
    update auction_bids set ${sql.join(fields.map((f) => sql`${f.column} = ${f.value}`), sql`, `)}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id
  `);
  return rows[0] ? getBid(userId, id) : null;
}

export async function deleteBid(userId: string, id: string): Promise<boolean> {
  const rows = await exec(sql`delete from auction_bids where id = ${id} and user_id = ${userId} returning id`);
  return rows.length > 0;
}
