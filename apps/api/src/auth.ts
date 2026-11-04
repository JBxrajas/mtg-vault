import { collections, user, session, account, verification } from "@mtg-vault/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, username } from "better-auth/plugins";
import { getDb } from "./db.js";
import { allowedOrigins } from "./origins.js";

function createAuth() {
  const db = getDb();
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
    trustedOrigins: allowedOrigins(),
    emailAndPassword: {
      enabled: true,
      // No email is ever sent: usernames are the identity, see syntheticEmail in packages/shared.
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    plugins: [
      username({ minUsernameLength: 3, maxUsernameLength: 30 }),
      // Sessions travel as `Authorization: Bearer <token>` so the web app (another origin than
      // the API) and Electron do not depend on third-party cookies.
      bearer(),
    ],
    databaseHooks: {
      user: {
        create: {
          // Every user has exactly one collection, created together with the account.
          after: async (created) => {
            await db.insert(collections).values({ userId: created.id }).onConflictDoNothing();
          },
        },
      },
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Lazy, like `getDb`, so importing the app does not need a database or secrets. */
export function getAuth() {
  return (instance ??= createAuth());
}
