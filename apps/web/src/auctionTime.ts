import { timeLeft } from "@mtg-vault/shared";
import { getLocale } from "./i18n";

const pad = (n: number) => String(n).padStart(2, "0");

/** An ISO timestamp as a `datetime-local` value in this device's time zone ("2026-11-26T22:59"). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value (this device's time zone) as an ISO timestamp; null when empty or invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "1d 05:02:03" or "05:02:03"; null without a closing time, "" once it has passed. */
export function countdown(closesAt: string | null, now: number): string | null {
  const left = timeLeft(closesAt, now);
  if (!left) return null;
  if (left.ms === 0) return "";
  const clock = `${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}`;
  return left.days > 0 ? `${left.days}d ${clock}` : clock;
}

const formats = new Map<string, Intl.DateTimeFormat>();
/** Short day and time in the page language, for example "Thu 26, 10:59 PM" or "jue 26, 22:59". */
export function shortDateTime(iso: string | null): string {
  if (!iso) return "";
  const locale = getLocale() === "es" ? "es-MX" : "en-US";
  let f = formats.get(locale);
  if (!f) formats.set(locale, (f = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit" })));
  return f.format(new Date(iso));
}
