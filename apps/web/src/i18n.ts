import { useSyncExternalStore } from "react";
import { en, type MessageKey } from "./messages/en";
import { es } from "./messages/es";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language written in itself, so it is recognizable whatever language the page is in. */
export const LOCALE_NAME: Record<Locale, string> = { en: "English", es: "Español" };

const catalogs = { en, es } satisfies Record<Locale, Record<MessageKey, unknown>>;
const KEY = "mtg-vault.locale";

export type Vars = Record<string, string | number>;

const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** Message text with `{name}` placeholders filled in; plural messages pick `one` or `other` from `vars.count`. */
export function translate(locale: Locale, key: MessageKey, vars: Vars = {}): string {
  const message = catalogs[locale][key] as string | { one: string; other: string };
  let text: string;
  if (typeof message === "string") text = message;
  else {
    const count = Number(vars.count);
    text = new Intl.PluralRules(locale).select(count) === "one" ? message.one : message.other;
  }
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** The saved language, else the browser's if we have it, else English. */
function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  const preferred = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of preferred) {
    const base = String(tag).slice(0, 2).toLowerCase();
    if (isLocale(base)) return base;
  }
  return "en";
}

let current: Locale = initialLocale();
const listeners = new Set<() => void>();

function announce() {
  if (typeof document !== "undefined") document.documentElement.lang = current;
  listeners.forEach((l) => l());
}

export function setLocale(locale: Locale) {
  current = locale;
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Ignore: the choice lasts until the page is reloaded.
  }
  announce();
}

export const getLocale = () => current;

/** Sets the document language from the saved choice; call once before the first render. */
export const startLocale = () => {
  if (typeof document !== "undefined") document.documentElement.lang = current;
};

/** Test helper: forget the saved language and go back to English. */
export function resetLocale() {
  current = "en";
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
  announce();
}

/** The translate function for the current language; components using it re-render when the language changes. */
export function useI18n() {
  const locale = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getLocale,
    getLocale,
  );
  return { locale, t: (key: MessageKey, vars?: Vars) => translate(locale, key, vars) };
}

/** For code outside React (error messages, formatting). Prefer `useI18n` in components. */
export const t = (key: MessageKey, vars?: Vars) => translate(current, key, vars);
