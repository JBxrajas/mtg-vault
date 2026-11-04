ALTER TABLE "cards" ALTER COLUMN "cmc" SET DATA TYPE numeric(10, 1);--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "cmc" SET DEFAULT '0';