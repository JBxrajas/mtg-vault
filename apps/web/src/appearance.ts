import { useSyncExternalStore } from "react";

/** Light, dark, or whatever the system says. */
export type Mode = "system" | "light" | "dark";

/** Tints named after the five colors of Magic. `default` leaves the neutral background. */
export const BACKGROUNDS = ["default", "white", "blue", "black", "red", "green", "gold"] as const;
export type Background = (typeof BACKGROUNDS)[number];

/** A card's art used as the page background. */
export interface Art {
  url: string;
  name: string;
  /** The card, so its other printings (each with its own art) can be offered later. */
  oracleId?: string;
}

export interface Appearance {
  mode: Mode;
  background: Background;
  art: Art | null;
  /** How much the art is covered by the page color, 50 to 95 (%). Higher is easier to read. */
  dimming: number;
}

export const DEFAULT_APPEARANCE: Appearance = { mode: "system", background: "default", art: null, dimming: 80 };
export const DIMMING_MIN = 50;
export const DIMMING_MAX = 95;

const KEY = "mtg-vault.appearance";

/** Card art comes from Scryfall; anything else is refused, because the URL ends up inside CSS. */
const ART_URL = /^https:\/\/cards\.scryfall\.io\/[A-Za-z0-9/._-]+(\?[A-Za-z0-9=&._-]*)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isArtUrl = (url: unknown): url is string => typeof url === "string" && ART_URL.test(url);

/** Reads whatever was stored and keeps only valid parts: storage can be old, edited or from another version. */
export function parseAppearance(raw: unknown): Appearance {
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const art = o.art as Partial<Art> | null | undefined;
  const dimming = typeof o.dimming === "number" && Number.isFinite(o.dimming) ? o.dimming : DEFAULT_APPEARANCE.dimming;
  return {
    mode: o.mode === "light" || o.mode === "dark" ? o.mode : "system",
    background: BACKGROUNDS.includes(o.background as Background) ? (o.background as Background) : "default",
    art:
      art && isArtUrl(art.url) && typeof art.name === "string"
        ? {
            url: art.url,
            name: art.name.slice(0, 200),
            ...(typeof art.oracleId === "string" && UUID.test(art.oracleId) ? { oracleId: art.oracleId } : {}),
          }
        : null,
    dimming: Math.min(DIMMING_MAX, Math.max(DIMMING_MIN, Math.round(dimming))),
  };
}

/** Puts the choice on the page: attributes and variables read by styles.css. */
export function applyAppearance(a: Appearance, root: HTMLElement = document.documentElement) {
  if (a.mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", a.mode);
  root.setAttribute("data-bg", a.background);
  if (a.art) {
    root.setAttribute("data-art", "");
    root.style.setProperty("--art-url", `url("${a.art.url}")`);
    root.style.setProperty("--art-scrim", String(a.dimming / 100));
  } else {
    root.removeAttribute("data-art");
    root.style.removeProperty("--art-url");
    root.style.removeProperty("--art-scrim");
  }
}

function load(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseAppearance(JSON.parse(raw)) : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

let current = load();
const listeners = new Set<() => void>();

/** Choose how the page looks. Saved on this device only; storage may be blocked, then it lasts until reload. */
export function setAppearance(patch: Partial<Appearance>) {
  current = parseAppearance({ ...current, ...patch });
  applyAppearance(current);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Ignore: the choice still applies to this visit.
  }
  listeners.forEach((l) => l());
}

export const getAppearance = () => current;

/** Applies the saved choice; call once before the first render so the page does not flash. */
export const startAppearance = () => applyAppearance(current);

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getAppearance,
    getAppearance,
  );
}

/** Test helper: forget the choice and go back to the defaults. */
export function resetAppearance() {
  current = DEFAULT_APPEARANCE;
  applyAppearance(current);
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
  listeners.forEach((l) => l());
}
