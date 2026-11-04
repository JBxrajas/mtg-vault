import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { sql } from "drizzle-orm";
import { cards, createDb, printings, sets } from "@mtg-vault/db";
const API = "https://api.scryfall.com";
const HEADERS = {
  "User-Agent": "mtg-vault-importer/0.1 (+https://github.com/JBxrajas/mtg-vault)",
  Accept: "application/json;q=0.9,*/*;q=0.8",
};
const BATCH = 1000;
const BULK_TYPE = process.env.BULK_TYPE ?? "default_cards";
/** Stop after this many cards; for testing only. */
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL)");

const { db, client } = createDb(databaseUrl);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** Overwrite a column with the value Postgres would have inserted. */
const excluded = (column: string) => sql.raw(`excluded."${column}"`);

async function importSets() {
  const { data } = await getJson<{ data: ScryfallSet[] }>(`${API}/sets`);
  const rows = data.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    setType: s.set_type,
    releasedAt: s.released_at ?? null,
    cardCount: s.card_count,
    iconSvgUri: s.icon_svg_uri ?? null,
  }));
  for (let i = 0; i < rows.length; i += BATCH) {
    await db
      .insert(sets)
      .values(rows.slice(i, i + BATCH))
      .onConflictDoUpdate({
        target: sets.id,
        set: {
          code: sql`${excluded("code")}`,
          name: sql`${excluded("name")}`,
          setType: sql`${excluded("set_type")}`,
          releasedAt: sql`${excluded("released_at")}`,
          cardCount: sql`${excluded("card_count")}`,
          iconSvgUri: sql`${excluded("icon_svg_uri")}`,
        },
      });
  }
  console.log(`sets: ${rows.length}`);
}

async function downloadBulk(path: string) {
  const { data } = await getJson<{ data: { type: string; jsonl_download_uri: string }[] }>(
    `${API}/bulk-data`,
  );
  const entry = data.find((d) => d.type === BULK_TYPE);
  if (!entry) throw new Error(`Bulk type not found: ${BULK_TYPE}`);
  const res = await fetch(entry.jsonl_download_uri, { headers: HEADERS });
  if (!res.ok || !res.body) throw new Error(`Bulk download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(path));
  console.log(`downloaded ${BULK_TYPE}`);
}

function toRows(card: ScryfallCard) {
  const face = card.card_faces?.[0];
  const oracleId = card.oracle_id ?? face?.oracle_id;
  if (!oracleId) return null;
  const faces = card.card_faces ?? [];
  const join = (key: "oracle_text" | "mana_cost" | "type_line") =>
    card[key] ?? (faces.map((f) => f[key]).filter(Boolean).join(" // ") || null);
  return {
    card: {
      oracleId,
      name: card.name,
      manaCost: join("mana_cost"),
      cmc: String(card.cmc ?? 0),
      typeLine: join("type_line") ?? "",
      oracleText: join("oracle_text"),
      colors: card.colors ?? face?.colors ?? [],
      colorIdentity: card.color_identity ?? [],
      keywords: card.keywords ?? [],
      legalities: card.legalities ?? {},
    },
    printing: {
      id: card.id,
      oracleId,
      setId: card.set_id,
      collectorNumber: card.collector_number,
      lang: card.lang,
      rarity: card.rarity,
      releasedAt: card.released_at ?? null,
      finishes: card.finishes ?? [],
      imageUris: card.image_uris ?? face?.image_uris ?? null,
    },
  };
}

async function flush(
  cardRows: Map<string, typeof cards.$inferInsert>,
  printingRows: Map<string, typeof printings.$inferInsert>,
) {
  if (cardRows.size) {
    await db
      .insert(cards)
      .values([...cardRows.values()])
      .onConflictDoUpdate({
        target: cards.oracleId,
        set: {
          name: sql`${excluded("name")}`,
          manaCost: sql`${excluded("mana_cost")}`,
          cmc: sql`${excluded("cmc")}`,
          typeLine: sql`${excluded("type_line")}`,
          oracleText: sql`${excluded("oracle_text")}`,
          colors: sql`${excluded("colors")}`,
          colorIdentity: sql`${excluded("color_identity")}`,
          keywords: sql`${excluded("keywords")}`,
          legalities: sql`${excluded("legalities")}`,
        },
      });
  }
  if (printingRows.size) {
    await db
      .insert(printings)
      .values([...printingRows.values()])
      .onConflictDoUpdate({
        target: printings.id,
        set: {
          oracleId: sql`${excluded("oracle_id")}`,
          setId: sql`${excluded("set_id")}`,
          collectorNumber: sql`${excluded("collector_number")}`,
          lang: sql`${excluded("lang")}`,
          rarity: sql`${excluded("rarity")}`,
          releasedAt: sql`${excluded("released_at")}`,
          finishes: sql`${excluded("finishes")}`,
          imageUris: sql`${excluded("image_uris")}`,
        },
      });
  }
}

async function importCards(path: string) {
  let cardRows = new Map<string, typeof cards.$inferInsert>();
  let printingRows = new Map<string, typeof printings.$inferInsert>();
  // Two printings of the same set, number and language would violate a unique constraint.
  let seenKeys = new Set<string>();
  let total = 0;
  let skipped = 0;

  // The bulk file is gzipped JSON Lines: one card per line.
  const input = createReadStream(path).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (total >= LIMIT) break;
    if (!line.trim()) continue;
    const value = JSON.parse(line) as ScryfallCard;
    const rows = toRows(value);
    if (!rows) {
      skipped++;
      continue;
    }
    const key = `${rows.printing.setId}/${rows.printing.collectorNumber}/${rows.printing.lang}`;
    if (seenKeys.has(key)) {
      skipped++;
      continue;
    }
    seenKeys.add(key);
    cardRows.set(rows.card.oracleId, rows.card);
    printingRows.set(rows.printing.id, rows.printing);
    total++;
    if (printingRows.size >= BATCH) {
      await flush(cardRows, printingRows);
      cardRows = new Map();
      printingRows = new Map();
      if (total % 20000 < BATCH) console.log(`printings: ${total}`);
    }
  }
  lines.close();
  input.destroy();
  await flush(cardRows, printingRows);
  console.log(`printings: ${total} imported, ${skipped} skipped`);
}

interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  icon_svg_uri?: string;
}

interface ScryfallFace {
  oracle_id?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  image_uris?: Record<string, string>;
}

interface ScryfallCard extends ScryfallFace {
  id: string;
  oracle_id?: string;
  name: string;
  set_id: string;
  collector_number: string;
  lang: string;
  rarity: string;
  released_at?: string;
  cmc?: number;
  color_identity?: string[];
  keywords?: string[];
  legalities?: Record<string, string>;
  finishes?: string[];
  card_faces?: ScryfallFace[];
}

const dir = process.env.DATA_DIR ?? "data";
await mkdir(dir, { recursive: true });
const file = `${dir}/${BULK_TYPE}.jsonl.gz`;
try {
  await importSets();
  if (!process.env.SKIP_DOWNLOAD) await downloadBulk(file);
  await importCards(file);
} catch (e) {
  // Drizzle wraps the driver error; print the Postgres message and detail.
  const cause = (e as { cause?: unknown }).cause ?? e;
  console.error("import failed:", cause);
  process.exitCode = 1;
} finally {
  await client.end();
}
