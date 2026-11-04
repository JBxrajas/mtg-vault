import type { QueryClient } from "@tanstack/react-query";

/** Queries that do not belong to an account: the public card catalogue and the session lookup itself. */
const PUBLIC_KEYS = ["cards", "me"];

/**
 * Call after signing in or out. Drops everything cached for the previous account (collection, decks…), so it
 * is neither shown after sign-out nor flashed to the next person who signs in, and re-reads who is signed in.
 */
export async function refreshSession(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (q) => !PUBLIC_KEYS.includes(String(q.queryKey[0])) });
  await queryClient.invalidateQueries({ queryKey: ["me"] });
}
