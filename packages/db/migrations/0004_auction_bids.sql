CREATE TABLE "auction_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"card_name" text NOT NULL,
	"oracle_id" uuid,
	"printing_id" uuid,
	"group_name" text,
	"seller" text,
	"post_url" text,
	"my_bid" numeric(10, 2),
	"high_bid" numeric(10, 2),
	"high_bidder" text,
	"max_bid" numeric(10, 2),
	"closes_at" timestamp with time zone,
	"status" text DEFAULT 'winning' NOT NULL,
	"pickup_place" text,
	"pickup_at" timestamp with time zone,
	"deck_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auction_bids_status_ck" CHECK ("auction_bids"."status" in ('winning', 'losing', 'won', 'lost', 'paid', 'picked_up'))
);
--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_oracle_id_cards_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."cards"("oracle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_printing_id_printings_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_bids_user_closes_idx" ON "auction_bids" USING btree ("user_id","closes_at");