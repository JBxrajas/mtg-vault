import type {
  CardImage,
  CardSearchQuery,
  CardSearchResult,
  PrintingPrices,
  PrintingSummary,
} from "@mtg-vault/shared";
import { sql } from "drizzle-orm";
import { getDb } from "./db.js";

/** Escape LIKE wildcards so user input is matched literally. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Picks the sizes the clients use out of a Scryfall `image_uris` object. */
export function toCardImage(uris: unknown): CardImage | null {
  if (!uris || typeof uris !== "object") return null;
  const { small, normal, art_crop: artCrop } = uris as Record<string, unknown>;
  if (typeof small !== "string" || typeof normal !== "string" || typeof artCrop !== "string") return null;
  return { small, normal, artCrop };
}

/**
 * Fuzzy name search backed by the `pg_trgm` GIN index on `cards.name`.
 * Exact matches first, then prefix matches, then by trigram similarity.
 */
export async function searchCards({ q, limit, type, colors }: CardSearchQuery) {
  const contains = `%${likeEscape(q)}%`;
  const prefix = `${likeEscape(q)}%`;
  const filters = [sql`(name % ${q} or name ilike ${contains})`];
  if (type) filters.push(sql`type_line ilike ${`%${likeEscape(type)}%`}`);
  if (colors?.length) filters.push(sql`color_identity @> array[${sql.join(colors, sql`, `)}]::text[]`);

  const rows = await getDb().execute<{
    oracle_id: string;
    name: string;
    mana_cost: string | null;
    type_line: string;
    similarity: number;
    image_uris: unknown;
  }>(sql`
    with matches as (
      select oracle_id, name, mana_cost, type_line, similarity(name, ${q}) as similarity
      from cards
      where ${sql.join(filters, sql` and `)}
      order by lower(name) = lower(${q}) desc,
               name ilike ${prefix} desc,
               similarity(name, ${q}) desc,
               name
      limit ${limit}
    )
    -- Image of the most recent printing that has one; only for the rows kept by the limit.
    select m.*, img.image_uris
    from matches m
    left join lateral (
      select p.image_uris
      from printings p
      where p.oracle_id = m.oracle_id and p.image_uris is not null
      order by p.released_at desc nulls last
      limit 1
    ) img on true
    order by lower(m.name) = lower(${q}) desc,
             m.name ilike ${prefix} desc,
             m.similarity desc,
             m.name
  `);

  return rows.map(
    (r): CardSearchResult => ({
      oracleId: r.oracle_id,
      name: r.name,
      manaCost: r.mana_cost,
      typeLine: r.type_line,
      similarity: Number(r.similarity),
      image: toCardImage(r.image_uris),
    }),
  );
}

/** numeric columns arrive as strings; null stays null. */
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export function toPrices(row: Record<string, unknown>): PrintingPrices | null {
  if (row.priced_on == null) return null;
  return {
    usd: num(row.usd),
    usdFoil: num(row.usd_foil),
    usdEtched: num(row.usd_etched),
    eur: num(row.eur),
    eurFoil: num(row.eur_foil),
    tix: num(row.tix),
  };
}

/** All printings of one oracle card, newest first, each with its latest recorded price. */
export async function listPrintings(oracleId: string): Promise<PrintingSummary[]> {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    select p.id, p.collector_number, p.lang, p.rarity, p.released_at, p.finishes, p.image_uris,
           s.code as set_code, s.name as set_name,
           ps.captured_on as priced_on, ps.usd, ps.usd_foil, ps.usd_etched, ps.eur, ps.eur_foil, ps.tix
    from printings p
    join sets s on s.id = p.set_id
    left join lateral (
      select captured_on, usd, usd_foil, usd_etched, eur, eur_foil, tix
      from price_snapshots
      where printing_id = p.id
      order by captured_on desc
      limit 1
    ) ps on true
    where p.oracle_id = ${oracleId}
    order by p.released_at desc nulls last, s.name, p.collector_number
  `);
  return rows.map((r) => ({
    id: r.id as string,
    setCode: r.set_code as string,
    setName: r.set_name as string,
    collectorNumber: r.collector_number as string,
    lang: r.lang as string,
    rarity: r.rarity as string,
    releasedAt: r.released_at == null ? null : String(r.released_at).slice(0, 10),
    finishes: (r.finishes as string[]) ?? [],
    image: toCardImage(r.image_uris),
    prices: toPrices(r),
    pricesOn: r.priced_on == null ? null : String(r.priced_on).slice(0, 10),
  }));
}
