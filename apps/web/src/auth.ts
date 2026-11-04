import type { CurrentUser, LoginInput, RegisterInput } from "@mtg-vault/shared";
import { API_URL } from "./api";

const TOKEN_KEY = "mtg-vault.token";

// Storage can be missing or throw (private windows, blocked site data): never depend on it.
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore: the session then lasts until the page is reloaded.
  }
}

export const authHeaders = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

/** Message from an API error body (`{ error }` or Zod issues), or a generic one. */
export async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string; success?: boolean };
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  } catch {
    // Not JSON.
  }
  return `Request failed (${res.status})`;
}

async function post(path: string, body: unknown, token: string | null = null): Promise<Response> {
  return fetch(new URL(path, API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });
}

async function takeToken(res: Response) {
  if (!res.ok) throw new Error(await errorMessage(res));
  const token = res.headers.get("set-auth-token");
  if (!token) throw new Error("The server did not return a session");
  setToken(token);
}

export async function register(input: RegisterInput) {
  await takeToken(await post("/auth/register", input));
}

export async function login(input: LoginInput) {
  await takeToken(await post("/api/auth/sign-in/username", input));
}

export async function logout() {
  const token = getToken();
  setToken(null);
  if (token) await post("/api/auth/sign-out", {}, token).catch(() => undefined);
}

/** The signed-in user, or null when there is no valid session. */
export async function fetchMe(signal?: AbortSignal): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(new URL("/me", API_URL), { headers: authHeaders(token), signal });
  if (res.status === 401) {
    setToken(null);
    return null;
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return ((await res.json()) as { user: CurrentUser }).user;
}
