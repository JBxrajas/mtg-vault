import type { CardSearchQuery, CardSearchResult } from "@mtg-vault/shared";
import { sql } from "drizzle-orm";
import { getDb } from "./db.js";

/** Escape LIKE wildcards so user input is matched literally. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, "\\$&");

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
  }>(sql`
    select oracle_id, name, mana_cost, type_line, similarity(name, ${q}) as similarity
    from cards
    where ${sql.join(filters, sql` and `)}
    order by lower(name) = lower(${q}) desc,
             name ilike ${prefix} desc,
             similarity(name, ${q}) desc,
             name
    limit ${limit}
  `);

  return rows.map(
    (r): CardSearchResult => ({
      oracleId: r.oracle_id,
      name: r.name,
      manaCost: r.mana_cost,
      typeLine: r.type_line,
      similarity: Number(r.similarity),
    }),
  );
}
