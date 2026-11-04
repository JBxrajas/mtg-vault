/** Prices as Scryfall sends them: decimal strings or null, per currency and finish. */
export interface ScryfallPrices {
  usd?: string | null;
  usd_foil?: string | null;
  usd_etched?: string | null;
  eur?: string | null;
  eur_foil?: string | null;
  tix?: string | null;
}

export interface PriceRow {
  usd: string | null;
  usdFoil: string | null;
  usdEtched: string | null;
  eur: string | null;
  eurFoil: string | null;
  tix: string | null;
}

const normalize = (v: string | null | undefined): string | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : null;
};

/** Normalizes to two decimals, as `numeric(10,2)` stores them. */
export function parsePrices(prices: ScryfallPrices | undefined): PriceRow {
  return {
    usd: normalize(prices?.usd),
    usdFoil: normalize(prices?.usd_foil),
    usdEtched: normalize(prices?.usd_etched),
    eur: normalize(prices?.eur),
    eurFoil: normalize(prices?.eur_foil),
    tix: normalize(prices?.tix),
  };
}

export const hasAnyPrice = (row: PriceRow) => Object.values(row).some((v) => v !== null);

/** Stable string used to tell whether the price changed since the last snapshot. */
export const priceKey = (row: PriceRow) =>
  [row.usd, row.usdFoil, row.usdEtched, row.eur, row.eurFoil, row.tix].map((v) => v ?? "").join("|");
