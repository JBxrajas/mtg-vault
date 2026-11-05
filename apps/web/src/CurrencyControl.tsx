import { useState } from "react";
import { RATE_MAX, RATE_MIN, setCurrency, useCurrency } from "./currency";
import { useI18n } from "./i18n";
import { Tip } from "./Tip";

/** Dollars or Mexican pesos, and the exchange rate to use for pesos. Saved on this device. */
export function CurrencyControl() {
  const { t } = useI18n();
  const prefs = useCurrency();
  const [text, setText] = useState(String(prefs.rate));
  const valid = Number(text) >= RATE_MIN && Number(text) <= RATE_MAX;

  return (
    <div className="currency" role="group" aria-label={t("currency.label")}>
      <span className="filter-title">{t("currency.label")}</span>
      <div className="chips">
        {(["USD", "MXN"] as const).map((c) => (
          <button key={c} type="button" className={prefs.currency === c ? "chip on" : "chip"} aria-pressed={prefs.currency === c} onClick={() => setCurrency({ currency: c })}>
            {c === "USD" ? t("currency.usd") : t("currency.mxn")}
          </button>
        ))}
        <Tip label={t("currency.tip.label")}>{t("currency.tip.text")}</Tip>
      </div>
      {prefs.currency === "MXN" && (
        <label className="rate">
          <span>{t("currency.rate")}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={RATE_MIN}
            max={RATE_MAX}
            value={text}
            aria-invalid={!valid}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (n >= RATE_MIN && n <= RATE_MAX) setCurrency({ rate: n });
            }}
          />
          <span>MXN</span>
        </label>
      )}
      {prefs.currency === "MXN" && !valid && <p className="error">{t("currency.rateInvalid", { min: RATE_MIN, max: RATE_MAX })}</p>}
    </div>
  );
}
