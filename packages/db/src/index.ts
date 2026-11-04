import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./auth-schema.js";
import * as schema from "./schema.js";

export * from "./auth-schema.js";
export * from "./schema.js";

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl);
  return { db: drizzle(client, { schema: { ...authSchema, ...schema } }), client };
}
