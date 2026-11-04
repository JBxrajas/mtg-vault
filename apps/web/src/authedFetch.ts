import { API_URL } from "./api";
import { authHeaders, errorMessage, getToken } from "./auth";

/** Calls the API with the session token; throws the server's message on a non-OK answer. */
export async function authedFetch(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error("Sign in to continue");
  const res = await fetch(new URL(path, API_URL), {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...authHeaders(token) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res;
}
