import { isBlankHash, matchConfidence, nearestArt, type ArtIndexEntry, type ArtMatch, type MatchConfidence, type PrintingSummary } from "@mtg-vault/shared";

export interface Candidates {
  cards: { oracleId: string; distance: number }[];
  confidence: MatchConfidence;
}

/** The cards some matches belong to, best first, without repeating a card whose other illustration also matched. */
export function candidatesFromMatches(matches: ArtMatch[], limit = 3): Candidates {
  const seen = new Set<string>();
  const cards: Candidates["cards"] = [];
  for (const m of matches) {
    if (seen.has(m.entry.oracleId)) continue;
    seen.add(m.entry.oracleId);
    cards.push({ oracleId: m.entry.oracleId, distance: m.distance });
    if (cards.length === limit) break;
  }
  return { cards, confidence: matchConfidence(matches) };
}

/** The cards the art could belong to, best first, with how sure the match is. */
export function candidateCards(index: ArtIndexEntry[], hash: Uint8Array, limit = 3): Candidates {
  if (isBlankHash(hash)) return { cards: [], confidence: "none" };
  return candidatesFromMatches(nearestArt(index, hash, limit * 4), limit);
}

/**
 * The printing to suggest: the newest one in the chosen language, else the newest one in English, else
 * the newest of all. The photo identifies the art, not the printing, so the user can change it.
 */
export function pickPrinting(printings: PrintingSummary[], lang: string): PrintingSummary | undefined {
  const newest = (list: PrintingSummary[]) => [...list].sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? ""))[0];
  return newest(printings.filter((p) => p.lang === lang)) ?? newest(printings.filter((p) => p.lang === "en")) ?? newest(printings);
}

/** The price shown with a scanned card: its first finish's price, in dollars, or null. */
export function scanPrice(printing: PrintingSummary): number | null {
  const p = printing.prices;
  if (!p) return null;
  const first = printing.finishes[0];
  return (first === "foil" ? p.usdFoil : first === "etched" ? p.usdEtched : p.usd) ?? p.usd ?? p.usdFoil ?? p.usdEtched ?? null;
}
