import { zValidator } from "@hono/zod-validator";
import {
  cardSearchQuerySchema,
  oracleIdParamSchema,
  registerSchema,
  syntheticEmail,
  type CurrentUser,
} from "@mtg-vault/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAuth } from "./auth.js";
import { listPrintings, searchCards } from "./cards.js";
import { allowedOrigins } from "./origins.js";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins().includes(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization"],
    // The session token comes back in this header on sign-up and sign-in.
    exposeHeaders: ["set-auth-token"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/cards/search", zValidator("query", cardSearchQuerySchema), async (c) => {
  const results = await searchCards(c.req.valid("query"));
  return c.json({ results });
});

app.get("/cards/:oracleId/printings", zValidator("param", oracleIdParamSchema), async (c) => {
  const printings = await listPrintings(c.req.valid("param").oracleId);
  if (printings.length === 0) return c.json({ error: "Card not found" }, 404);
  return c.json({ printings });
});

// Better Auth owns /api/auth/*. Email sign-up is closed: accounts are created through
// POST /auth/register so every user has a username.
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  if (c.req.path.endsWith("/sign-up/email")) return c.json({ error: "Use POST /auth/register" }, 404);
  return getAuth().handler(c.req.raw);
});

/** Creates an account from a username and a password. Returns the user and `set-auth-token`. */
app.post("/auth/register", zValidator("json", registerSchema), async (c) => {
  const { username, password } = c.req.valid("json");
  try {
    return await getAuth().api.signUpEmail({
      body: { email: syntheticEmail(username), password, name: username, username },
      asResponse: true,
    });
  } catch (e) {
    // Better Auth throws an APIError for rule violations such as a taken username.
    const err = e as { statusCode?: number; message?: string };
    if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500) {
      return c.json({ error: err.message ?? "Could not register" }, err.statusCode as 400 | 409 | 422);
    }
    throw e;
  }
});

/** The signed-in user, from the `Authorization: Bearer` token. */
app.get("/me", async (c) => {
  const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Not signed in" }, 401);
  const u = session.user as { id: string; username?: string | null; displayUsername?: string | null };
  const me: CurrentUser = {
    id: u.id,
    username: u.username ?? "",
    displayUsername: u.displayUsername ?? u.username ?? "",
  };
  return c.json({ user: me });
});
