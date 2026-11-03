CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "cards" (
	"oracle_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mana_cost" text,
	"cmc" numeric(6, 1) DEFAULT '0' NOT NULL,
	"type_line" text DEFAULT '' NOT NULL,
	"oracle_text" text,
	"colors" text[] DEFAULT '{}'::text[] NOT NULL,
	"color_identity" text[] DEFAULT '{}'::text[] NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"legalities" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"printing_id" uuid NOT NULL,
	"captured_on" date NOT NULL,
	"usd" numeric(10, 2),
	"usd_foil" numeric(10, 2),
	"usd_etched" numeric(10, 2),
	"eur" numeric(10, 2),
	"eur_foil" numeric(10, 2),
	"tix" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_snapshots_printing_id_captured_on_pk" PRIMARY KEY("printing_id","captured_on")
);
--> statement-breakpoint
CREATE TABLE "printings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"oracle_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"collector_number" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"rarity" text NOT NULL,
	"released_at" date,
	"finishes" text[] DEFAULT '{}'::text[] NOT NULL,
	"image_uris" jsonb,
	CONSTRAINT "printings_set_number_lang_uq" UNIQUE("set_id","collector_number","lang")
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"set_type" text NOT NULL,
	"released_at" date,
	"card_count" integer DEFAULT 0 NOT NULL,
	"icon_svg_uri" text,
	CONSTRAINT "sets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_printing_id_printings_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printings" ADD CONSTRAINT "printings_oracle_id_cards_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."cards"("oracle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printings" ADD CONSTRAINT "printings_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_name_trgm_idx" ON "cards" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "printings_oracle_id_idx" ON "printings" USING btree ("oracle_id");