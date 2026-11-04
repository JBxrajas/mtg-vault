import type { PrintingPrices, PrintingSummary } from "@mtg-vault/shared";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const eur = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" });

export const formatUsd = (v: number | null) => (v == null ? null : usd.format(v));
export const formatEur = (v: number | null) => (v == null ? null : eur.format(v));

/** Short price line for a printing, for example "$1.50 · foil $3.00 · €1.20". Null without any price. */
export function priceLine(prices: PrintingPrices | null): string | null {
  if (!prices) return null;
  const parts = [
    formatUsd(prices.usd),
    prices.usdFoil != null ? `foil ${formatUsd(prices.usdFoil)}` : null,
    prices.usdEtched != null ? `etched ${formatUsd(prices.usdEtched)}` : null,
    formatEur(prices.eur),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** "Lightning Bolt" printing label, for example "Alpha (LEA) #161". */
export const printingLabel = (p: Pick<PrintingSummary, "setName" | "setCode" | "collectorNumber">) =>
  `${p.setName} (${p.setCode.toUpperCase()}) #${p.collectorNumber}`;

export const releaseYear = (releasedAt: string | null) => releasedAt?.slice(0, 4) ?? "";
