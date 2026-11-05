import {
  unitPriceUsd,
  type CollectionEntry,
  type CollectionItem,
  type Condition,
  type Finish,
  type UpdateCollectionItem,
} from "@mtg-vault/shared";
import { sql } from "drizzle-orm";
import { toCardImage, toPrices } from "./cards.js";
import { getDb } from "./db.js";

/** An error with the HTTP status the route should answer with. */
export class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

type Row = Record<string, unknown>;
const exec = (query: ReturnType<typeof sql>) => getDb().execute<Row>(query);
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const str = (v: unknown): string | null => (v == null ? null : String(v));

export function toCollectionItem(r: Row): CollectionItem {
  const finish = r.finish as Finish;
  return {
    id: r.id as string,
    printingId: r.printing_id as string,
    oracleId: r.oracle_id as string,
    name: r.name as string,
    typeLine: (r.type_line as string | null) ?? "",
    cmc: Number(r.cmc ?? 0),
    colorIdentity: ((r.color_identity as string[] | null) ?? []) as CollectionItem["colorIdentity"],
    setCode: r.set_code as string,
    setName: r.set_name as string,
    collectorNumber: r.collector_number as string,
    rarity: r.rarity as string,
    finish,
    condition: r.condition as Condition,
    language: r.language as string,
    quantity: Number(r.quantity),
    purchasePrice: num(r.purchase_price),
    acquiredOn: str(r.acquired_on)?.slice(0, 10) ?? null,
    notes: str(r.notes),
    image: toCardImage(r.image_uris),
    unitPrice: unitPriceUsd(finish, toPrices(r)),
    pricesOn: str(r.priced_on)?.slice(0, 10) ?? null,
  };
}

const selectItems = (where: ReturnType<typeof sql>) => sql`
  select ci.id, ci.printing_id, p.oracle_id, c.name, c.type_line, c.cmc, c.color_identity, s.code as set_code, s.name as set_name,
         p.collector_number, p.rarity, p.image_uris,
         ci.finish, ci.condition, ci.language, ci.quantity, ci.purchase_price, ci.acquired_on, ci.notes,
         ps.captured_on as priced_on, ps.usd, ps.usd_foil, ps.usd_etched, ps.eur, ps.eur_foil, ps.tix
  from collection_items ci
  join printings p on p.id = ci.printing_id
  join cards c on c.oracle_id = p.oracle_id
  join sets s on s.id = p.set_id
  left join lateral (
    select captured_on, usd, usd_foil, usd_etched, eur, eur_foil, tix
    from price_snapshots where printing_id = p.id order by captured_on desc limit 1
  ) ps on true
  where ${where}
  order by c.name, s.name, ci.finish, ci.condition
`;

/** The user's one collection. Created on sign-up; created here too for accounts that predate that. */
export async function getCollectionId(userId: string): Promise<string> {
  const rows = await exec(sql`
    insert into collections (user_id) values (${userId})
    on conflict (user_id) do update set user_id = excluded.user_id
    returning id
  `);
  return rows[0]!.id as string;
}

export async function listItems(collectionId: string): Promise<CollectionItem[]> {
  const rows = await exec(selectItems(sql`ci.collection_id = ${collectionId}`));
  return rows.map(toCollectionItem);
}

async function getItem(collectionId: string, id: string): Promise<CollectionItem | null> {
  const rows = await exec(selectItems(sql`ci.collection_id = ${collectionId} and ci.id = ${id}`));
  return rows[0] ? toCollectionItem(rows[0]) : null;
}

/** Adds copies. The same printing, finish, condition and language adds to the existing stack. */
export async function addItem(collectionId: string, entry: CollectionEntry): Promise<CollectionItem> {
  const printing = await exec(sql`select finishes from printings where id = ${entry.printingId}`);
  if (!printing[0]) throw new HttpError(404, "Printing not found");
  const finishes = (printing[0].finishes as string[]) ?? [];
  if (!finishes.includes(entry.finish)) {
    throw new HttpError(400, `This printing does not come in ${entry.finish} (available: ${finishes.join(", ") || "none"})`);
  }
  const rows = await exec(sql`
    insert into collection_items
      (collection_id, printing_id, finish, condition, language, quantity, purchase_price, acquired_on, notes)
    values (${collectionId}, ${entry.printingId}, ${entry.finish}, ${entry.condition}, ${entry.language},
            ${entry.quantity}, ${entry.purchasePrice ?? null}, ${entry.acquiredOn ?? null}, ${entry.notes ?? null})
    on conflict (collection_id, printing_id, finish, condition, language) do update
      set quantity = collection_items.quantity + excluded.quantity,
          purchase_price = coalesce(excluded.purchase_price, collection_items.purchase_price),
          acquired_on = coalesce(excluded.acquired_on, collection_items.acquired_on),
          notes = coalesce(excluded.notes, collection_items.notes),
          updated_at = now()
    where collection_items.quantity + excluded.quantity <= 9999
    returning id
  `);
  if (!rows[0]) throw new HttpError(400, "A stack cannot hold more than 9999 copies");
  return (await getItem(collectionId, rows[0].id as string))!;
}

/** Changes quantity, purchase data or notes. Returns null when the stack is not in this collection. */
export async function updateItem(
  collectionId: string,
  id: string,
  patch: UpdateCollectionItem,
): Promise<CollectionItem | null> {
  // The stack and its binder placements do not depend on each other: read them in one round trip.
  const [current, inBinders] = await Promise.all([
    getItem(collectionId, id),
    patch.quantity !== undefined
      ? exec(sql`select coalesce(sum(quantity), 0)::int as n from binder_items where collection_item_id = ${id}`)
      : Promise.resolve(null),
  ]);
  if (!current) return null;

  if (patch.quantity !== undefined && inBinders) {
    const n = Number(inBinders[0]!.n);
    if (patch.quantity < n) {
      throw new HttpError(409, `${n} copies are placed in binders; take them out of the binders first`);
    }
  }

  await exec(sql`
    update collection_items set
      quantity = ${patch.quantity ?? current.quantity},
      purchase_price = ${patch.purchasePrice !== undefined ? patch.purchasePrice : current.purchasePrice},
      acquired_on = ${patch.acquiredOn !== undefined ? patch.acquiredOn : current.acquiredOn},
      notes = ${patch.notes !== undefined ? patch.notes : current.notes},
      updated_at = now()
    where id = ${id} and collection_id = ${collectionId}
  `);
  return getItem(collectionId, id);
}

/** Removes a stack (and its binder placements). False when it is not in this collection. */
export async function removeItem(collectionId: string, id: string): Promise<boolean> {
  const rows = await exec(
    sql`delete from collection_items where id = ${id} and collection_id = ${collectionId} returning id`,
  );
  return rows.length > 0;
}
