/**
 * Features open only to some accounts. Each is turned on by an environment variable listing the
 * accounts, comma-separated, by user id or username (case-insensitive). Empty or unset: nobody.
 * Nothing about who has a feature is written in the code.
 */
export const FEATURES = { auctions: "AUCTIONS_USERS" } as const;
export type Feature = keyof typeof FEATURES;

function allowed(feature: Feature): Set<string> {
  const raw = process.env[FEATURES[feature]] ?? "";
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function hasFeature(feature: Feature, user: { id: string; username?: string | null }): boolean {
  const list = allowed(feature);
  return list.has(user.id.toLowerCase()) || (!!user.username && list.has(user.username.toLowerCase()));
}

export function userFeatures(user: { id: string; username?: string | null }): Feature[] {
  return (Object.keys(FEATURES) as Feature[]).filter((f) => hasFeature(f, user));
}
