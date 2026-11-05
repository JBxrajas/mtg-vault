/** The parts of a Scryfall card (or one face of it) that decide which art images it has. */
export interface ScryfallArtFace {
  oracle_id?: string;
  illustration_id?: string;
  image_uris?: { art_crop?: string };
}
export interface ScryfallArtCard extends ScryfallArtFace {
  digital?: boolean;
  image_status?: string;
  card_faces?: ScryfallArtFace[];
}

export interface ArtSource {
  illustrationId: string;
  oracleId: string;
  url: string;
}

/**
 * The illustrations of one printing that are worth fingerprinting: one per face, none for digital-only
 * cards or cards whose scan is missing or a placeholder. Callers keep the first source they see for
 * each `illustrationId`, since reprints share both the art and the fingerprint.
 */
export function artSources(card: ScryfallArtCard): ArtSource[] {
  if (card.digital || card.image_status === "missing" || card.image_status === "placeholder") return [];
  const oracleId = card.oracle_id ?? card.card_faces?.find((f) => f.oracle_id)?.oracle_id;
  if (!oracleId) return [];
  const faces = card.card_faces?.some((f) => f.image_uris) ? card.card_faces : [card];
  const sources: ArtSource[] = [];
  for (const face of faces ?? []) {
    const url = face.image_uris?.art_crop;
    const illustrationId = face.illustration_id;
    if (!url || !illustrationId || sources.some((s) => s.illustrationId === illustrationId)) continue;
    sources.push({ illustrationId, oracleId: face.oracle_id ?? oracleId, url });
  }
  return sources;
}

/** The illustration of each face of a printing (one for a single-faced card), without repeats; null when there is none. */
export function illustrationIdsOf(card: { illustration_id?: string; card_faces?: { illustration_id?: string }[] }): string[] | null {
  const ids = [card.illustration_id, ...(card.card_faces ?? []).map((f) => f.illustration_id)].filter((id): id is string => !!id);
  const unique = [...new Set(ids)];
  return unique.length > 0 ? unique : null;
}
