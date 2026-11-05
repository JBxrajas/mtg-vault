import { useSyncExternalStore } from "react";
import { money } from "./format";

/** Prices come from Scryfall in US dollars; Mexican pesos are converted with a rate the user sets. */
export type Currency = "USD" | "MXN";

export interface CurrencyPrefs {
  currency: Currency;
  /** Pesos for one dollar. */
  rate: number;
}

/** A starting guess, not a live rate: the page says so and the user sets their own. */
export const DEFAULT_RATE = 18;
export const RATE_MIN = 0.01;
export const RATE_MAX = 1000;
export const DEFAULT_CURRENCY: CurrencyPrefs = { currency: "USD", rate: DEFAULT_RATE };

const KEY = "mtg-vault.currency";

/** Keeps only valid parts of whatever was stored (storage can be old or edited). */
export function parseCurrency(raw: unknown): CurrencyPrefs {
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const rate = typeof o.rate === "number" && Number.isFinite(o.rate) && o.rate >= RATE_MIN && o.rate <= RATE_MAX ? o.rate : DEFAULT_RATE;
  return { currency: o.currency === "MXN" ? "MXN" : "USD", rate };
}

/** A dollar amount in the chosen currency, formatted for the page language. */
export function formatMoney(usd: number, prefs: CurrencyPrefs): string {
  return prefs.currency === "MXN" ? money("MXN", usd * prefs.rate) : money("USD", usd);
}

function load(): CurrencyPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseCurrency(JSON.parse(raw)) : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

let current = load();
const listeners = new Set<() => void>();

/** Choose the currency and the rate. Saved on this device only; an invalid rate is ignored. */
export function setCurrency(patch: Partial<CurrencyPrefs>) {
  current = parseCurrency({ ...current, ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Ignore: the choice still applies to this visit.
  }
  listeners.forEach((l) => l());
}

export const getCurrency = () => current;

export function useCurrency(): CurrencyPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getCurrency,
    getCurrency,
  );
}

/** Test helper: forget the choice. */
export function resetCurrency() {
  current = DEFAULT_CURRENCY;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
  listeners.forEach((l) => l());
}
