import { isArtUrl } from "./appearance";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Our printing ids are Scryfall ids, so they open that printing on Scryfall. */
export const isPrintingId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** Size of what Scryfall serves, in pixels: the art-only image is its largest one, the full card is the other. */
export const ART_SIZE = { artCrop: { width: 626, height: 457 }, png: { width: 745, height: 1040 } } as const;

export interface ArtFace {
  name: string;
  artist: string | null;
  /** The art alone. Null when the card has none or the address is not a Scryfall image. */
  artCrop: string | null;
  /** The whole card at its largest. */
  png: string | null;
  flavorText: string | null;
}

export interface ArtInfo {
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  releasedAt: string | null;
  /** The card's page on Scryfall, which also shows the artist and the other printings of the art. */
  scryfallUri: string | null;
  faces: ArtFace[];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const image = (uris: unknown, key: string): string | null => {
  const url = typeof uris === "object" && uris !== null ? (uris as Record<string, unknown>)[key] : null;
  return isArtUrl(url) ? url : null;
};

/** Reads a Scryfall card object (`GET /cards/:id`). Image and page addresses that do not belong to Scryfall are dropped. */
export function parseScryfallArt(card: unknown): ArtInfo {
  const c = (typeof card === "object" && card !== null ? card : {}) as Record<string, unknown>;
  const rawFaces = Array.isArray(c.card_faces) ? (c.card_faces as Record<string, unknown>[]) : [];
  // A double-faced card keeps its images on the faces; a card with one image set has them on the card itself.
  const faceSources = rawFaces.some((f) => f.image_uris) ? rawFaces.filter((f) => f.image_uris) : [c];
  const scryfallUri = str(c.scryfall_uri);
  return {
    name: str(c.name) ?? "",
    setName: str(c.set_name) ?? "",
    setCode: str(c.set) ?? "",
    collectorNumber: str(c.collector_number) ?? "",
    releasedAt: str(c.released_at),
    scryfallUri: scryfallUri?.startsWith("https://scryfall.com/") ? scryfallUri : null,
    faces: faceSources.map((f) => ({
      name: str(f.name) ?? str(c.name) ?? "",
      artist: str(f.artist) ?? str(c.artist),
      artCrop: image(f.image_uris, "art_crop"),
      png: image(f.image_uris, "png"),
      flavorText: str(f.flavor_text),
    })),
  };
}

/** Scryfall's search for everything by one artist, one result per illustration. */
export const artistSearchUrl = (artist: string) =>
  `https://scryfall.com/search?q=${encodeURIComponent(`a:"${artist.replace(/"/g, "")}"`)}&unique=art&as=grid&order=released`;

/**
 * Loads one printing from Scryfall, from the browser, only when someone opens its art (one request per view,
 * within Scryfall's rules); the answer is cached by the caller. The artist is not in our own database.
 */
export async function fetchArt(printingId: string, signal?: AbortSignal): Promise<ArtInfo> {
  if (!isPrintingId(printingId)) throw new Error("Not a card id");
  const res = await fetch(`https://api.scryfall.com/cards/${printingId}`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Scryfall answered ${res.status}`);
  return parseScryfallArt(await res.json());
}

/** Where the art page of a printing lives, as a link that opens in a new window (the app uses hash routes). */
export const artHref = (printingId: string) => `#/art/${printingId}`;
