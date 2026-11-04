import type { PrintingPrices, PrintingSummary } from "@mtg-vault/shared";
import { getLocale, t } from "./i18n";

const formats = new Map<string, Intl.NumberFormat>();
/** Currency format for the page language: "$1,234.50" in English, "1234,50 US$" in Spanish. */
function money(currency: "USD" | "EUR", v: number) {
  const locale = getLocale() === "es" ? "es-ES" : "en-US";
  const key = `${locale}/${currency}`;
  let f = formats.get(key);
  if (!f) formats.set(key, (f = new Intl.NumberFormat(locale, { style: "currency", currency })));
  return f.format(v);
}

export const formatUsd = (v: number | null) => (v == null ? null : money("USD", v));
export const formatEur = (v: number | null) => (v == null ? null : money("EUR", v));

/** Short price line for a printing, for example "$1.50 · foil $3.00 · €1.20". Null without any price. */
export function priceLine(prices: PrintingPrices | null): string | null {
  if (!prices) return null;
  const parts = [
    formatUsd(prices.usd),
    prices.usdFoil != null ? `${t("finish.foil")} ${formatUsd(prices.usdFoil)}` : null,
    prices.usdEtched != null ? `${t("finish.etched")} ${formatUsd(prices.usdEtched)}` : null,
    formatEur(prices.eur),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** "Lightning Bolt" printing label, for example "Alpha (LEA) #161". */
export const printingLabel = (p: Pick<PrintingSummary, "setName" | "setCode" | "collectorNumber">) =>
  `${p.setName} (${p.setCode.toUpperCase()}) #${p.collectorNumber}`;

export const releaseYear = (releasedAt: string | null) => releasedAt?.slice(0, 4) ?? "";
