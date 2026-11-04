import { createDb } from "@mtg-vault/db";

let instance: ReturnType<typeof createDb> | undefined;

/** Lazy so that importing the app (for example in tests) does not open a connection. */
export function getDb() {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    instance = createDb(url);
  }
  return instance.db;
}
