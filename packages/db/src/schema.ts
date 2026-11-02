import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** A set (edition). `id` is the Scryfall set id. */
export const sets = pgTable("sets", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  setType: text("set_type").notNull(),
  releasedAt: date("released_at"),
  cardCount: integer("card_count").notNull().default(0),
  iconSvgUri: text("icon_svg_uri"),
});

/** An oracle card: the card as a concept, independent of printing. `oracleId` is the Scryfall oracle id. */
export const cards = pgTable(
  "cards",
  {
    oracleId: uuid("oracle_id").primaryKey(),
    name: text("name").notNull(),
    manaCost: text("mana_cost"),
    cmc: numeric("cmc", { precision: 6, scale: 1 }).notNull().default("0"),
    typeLine: text("type_line").notNull().default(""),
    oracleText: text("oracle_text"),
    colors: text("colors").array().notNull().default(sql`'{}'::text[]`),
    colorIdentity: text("color_identity").array().notNull().default(sql`'{}'::text[]`),
    keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
    legalities: jsonb("legalities").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    // Fuzzy name search (requires the pg_trgm extension, created in the migration).
    index("cards_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

/** A printing: a specific version of a card in a set. `id` is the Scryfall card id. */
export const printings = pgTable(
  "printings",
  {
    id: uuid("id").primaryKey(),
    oracleId: uuid("oracle_id")
      .notNull()
      .references(() => cards.oracleId),
    setId: uuid("set_id")
      .notNull()
      .references(() => sets.id),
    collectorNumber: text("collector_number").notNull(),
    lang: text("lang").notNull().default("en"),
    rarity: text("rarity").notNull(),
    releasedAt: date("released_at"),
    finishes: text("finishes").array().notNull().default(sql`'{}'::text[]`),
    imageUris: jsonb("image_uris"),
  },
  (t) => [
    unique("printings_set_number_lang_uq").on(t.setId, t.collectorNumber, t.lang),
    index("printings_oracle_id_idx").on(t.oracleId),
  ],
);

/** Daily price of a printing. Scryfall keeps no history, so we snapshot it ourselves. */
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    printingId: uuid("printing_id")
      .notNull()
      .references(() => printings.id),
    capturedOn: date("captured_on").notNull(),
    usd: numeric("usd", { precision: 10, scale: 2 }),
    usdFoil: numeric("usd_foil", { precision: 10, scale: 2 }),
    usdEtched: numeric("usd_etched", { precision: 10, scale: 2 }),
    eur: numeric("eur", { precision: 10, scale: 2 }),
    eurFoil: numeric("eur_foil", { precision: 10, scale: 2 }),
    tix: numeric("tix", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.printingId, t.capturedOn] })],
);
