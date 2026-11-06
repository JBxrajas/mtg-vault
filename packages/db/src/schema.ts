import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import { user } from "./auth-schema.js";

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
    cmc: numeric("cmc", { precision: 10, scale: 1 }).notNull().default("0"),
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
    /** The name printed instead of the card's own (Universes Beyond, Secret Lair): "Paradise Chocobo" for Birds of Paradise. */
    flavorName: text("flavor_name"),
    /** Scryfall illustration ids of the printing's faces: the scanner finds the printing that has the art it saw. */
    illustrationIds: uuid("illustration_ids").array(),
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

/** A user's single collection: everything they own. Binders subdivide it. */
export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique() // one collection per user
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Inventory: one row per stack of identical cards. Different printings, finishes,
 * conditions or languages of the same card are different rows.
 */
export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    printingId: uuid("printing_id")
      .notNull()
      .references(() => printings.id),
    finish: text("finish").notNull().default("nonfoil"), // nonfoil | foil | etched
    condition: text("condition").notNull().default("NM"), // NM | LP | MP | HP | DMG
    language: text("language").notNull().default("en"),
    quantity: integer("quantity").notNull(),
    purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
    acquiredOn: date("acquired_on"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("collection_items_stack_uq").on(
      t.collectionId,
      t.printingId,
      t.finish,
      t.condition,
      t.language,
    ),
    index("collection_items_printing_idx").on(t.printingId),
    check("collection_items_quantity_pos", sql`${t.quantity} > 0`),
  ],
);

/** A binder: a named sub-collection (a physical binder, a box, a trade list). */
export const binders = pgTable(
  "binders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("binders_collection_name_uq").on(t.collectionId, t.name)],
);

/**
 * How many copies of an inventory stack sit in a binder. A stack can be split across
 * binders; the sum over binders must not exceed the stack's quantity (enforced by the API).
 */
export const binderItems = pgTable(
  "binder_items",
  {
    binderId: uuid("binder_id")
      .notNull()
      .references(() => binders.id, { onDelete: "cascade" }),
    collectionItemId: uuid("collection_item_id")
      .notNull()
      .references(() => collectionItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.binderId, t.collectionItemId] }),
    check("binder_items_quantity_pos", sql`${t.quantity} > 0`),
  ],
);

/** A deck. A user has many. Decks are lists of oracle cards, independent of what is owned. */
export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    format: text("format").notNull().default("casual"), // see deckFormatSchema in packages/shared
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decks_user_idx").on(t.userId)],
);

/**
 * A card in a deck. The type groups (creature, instant, ...) are derived from
 * `cards.type_line` when reading (`groupByCategory` in packages/shared), not stored.
 */
export const deckCards = pgTable(
  "deck_cards",
  {
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    oracleId: uuid("oracle_id")
      .notNull()
      .references(() => cards.oracleId),
    board: text("board").notNull().default("main"), // main | sideboard | maybeboard | commander
    quantity: integer("quantity").notNull(),
    printingId: uuid("printing_id").references(() => printings.id),
  },
  (t) => [
    primaryKey({ columns: [t.deckId, t.oracleId, t.board] }),
    check("deck_cards_quantity_pos", sql`${t.quantity} > 0`),
  ],
);
