/** Origins allowed to call the API from a browser, comma-separated in `CORS_ORIGINS`. */
export const defaultOrigins = ["http://localhost:5173"];

export function allowedOrigins(): string[] {
  return process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? defaultOrigins;
}
