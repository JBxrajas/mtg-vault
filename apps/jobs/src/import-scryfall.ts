import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { sql } from "drizzle-orm";
import { cards, createDb, priceSnapshots, printings, sets } from "@mtg-vault/db";
import { API, downloadBulk, getJson } from "./bulk.js";
import { hasAnyPrice, parsePrices, priceKey, type PriceRow, type ScryfallPrices } from "./prices.js";
const BATCH = 1000;
const BULK_TYPE = process.env.BULK_TYPE ?? "default_cards";
/** Stop after this many cards; for testing only. */
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL)");

const { db, client } = createDb(databaseUrl);

/** Overwrite a column with the value Postgres would have inserted. */
const excluded = (column: string) => sql.raw(`excluded."${column}"`);

/**
 * Condition for `ON CONFLICT DO UPDATE ... WHERE`: only rewrite a row when one of the columns
 * changed. Rewriting identical rows would leave a dead copy of every row on each import.
 */
const changed = (table: string, columns: string[]) =>
  sql.raw(
    `(${columns.map((c) => `"${table}"."${c}"`).join(", ")}) is distinct from (${columns
      .map((c) => `excluded."${c}"`)
      .join(", ")})`,
  );

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
        setWhere: changed("sets", ["code", "name", "set_type", "released_at", "card_count", "icon_svg_uri"]),
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
  priceRows: Map<string, PriceRow> = new Map(),
) {
  if (cardRows.size) {
    await db
      .insert(cards)
      .values([...cardRows.values()])
      .onConflictDoUpdate({
        target: cards.oracleId,
        setWhere: changed("cards", [
          "name",
          "mana_cost",
          "cmc",
          "type_line",
          "oracle_text",
          "colors",
          "color_identity",
          "keywords",
          "legalities",
        ]),
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
        setWhere: changed("printings", [
          "oracle_id",
          "set_id",
          "collector_number",
          "lang",
          "rarity",
          "released_at",
          "finishes",
          "image_uris",
        ]),
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
  await flushPrices(priceRows);
}

const today = new Date().toISOString().slice(0, 10);

/** Latest stored price per printing, as `priceKey`, to snapshot only what changed. */
async function loadLastPriceKeys() {
  const rows = await db.execute<{
    printing_id: string;
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
    eur: string | null;
    eur_foil: string | null;
    tix: string | null;
  }>(sql`
    select distinct on (printing_id) printing_id, usd, usd_foil, usd_etched, eur, eur_foil, tix
    from price_snapshots
    order by printing_id, captured_on desc
  `);
  return new Map(
    rows.map((r) => [
      r.printing_id,
      priceKey({
        usd: r.usd,
        usdFoil: r.usd_foil,
        usdEtched: r.usd_etched,
        eur: r.eur,
        eurFoil: r.eur_foil,
        tix: r.tix,
      }),
    ]),
  );
}

async function flushPrices(priceRows: Map<string, PriceRow>) {
  if (!priceRows.size) return;
  await db
    .insert(priceSnapshots)
    .values([...priceRows].map(([printingId, row]) => ({ printingId, capturedOn: today, ...row })))
    .onConflictDoUpdate({
      target: [priceSnapshots.printingId, priceSnapshots.capturedOn],
      set: {
        usd: sql`${excluded("usd")}`,
        usdFoil: sql`${excluded("usd_foil")}`,
        usdEtched: sql`${excluded("usd_etched")}`,
        eur: sql`${excluded("eur")}`,
        eurFoil: sql`${excluded("eur_foil")}`,
        tix: sql`${excluded("tix")}`,
      },
    });
}

async function importCards(path: string) {
  const lastPrices = await loadLastPriceKeys();
  let priceRows = new Map<string, PriceRow>();
  let snapshots = 0;
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
    // Snapshot a price only when it differs from the latest one we have.
    const price = parsePrices(value.prices);
    if (hasAnyPrice(price) && lastPrices.get(rows.printing.id) !== priceKey(price)) {
      priceRows.set(rows.printing.id, price);
      lastPrices.set(rows.printing.id, priceKey(price));
    }
    total++;
    if (printingRows.size >= BATCH) {
      snapshots += priceRows.size;
      await flush(cardRows, printingRows, priceRows);
      cardRows = new Map();
      printingRows = new Map();
      priceRows = new Map();
      if (total % 20000 < BATCH) console.log(`printings: ${total}`);
    }
  }
  lines.close();
  input.destroy();
  snapshots += priceRows.size;
  await flush(cardRows, printingRows, priceRows);
  console.log(`printings: ${total} imported, ${skipped} skipped; price snapshots written: ${snapshots}`);
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
  prices?: ScryfallPrices;
}

const dir = process.env.DATA_DIR ?? "data";
await mkdir(dir, { recursive: true });
const file = `${dir}/${BULK_TYPE}.jsonl.gz`;
try {
  await importSets();
  if (!process.env.SKIP_DOWNLOAD) await downloadBulk(BULK_TYPE, file);
  await importCards(file);
} catch (e) {
  // Drizzle wraps the driver error; print the Postgres message and detail.
  const cause = (e as { cause?: unknown }).cause ?? e;
  console.error("import failed:", cause);
  process.exitCode = 1;
} finally {
  await client.end();
}
