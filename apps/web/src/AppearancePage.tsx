import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPrintings, searchCards } from "./api";
import {
  BACKGROUNDS,
  DIMMING_MAX,
  DIMMING_MIN,
  isArtUrl,
  setAppearance,
  useAppearance,
  type Background,
  type Mode,
} from "./appearance";
import { printingLabel } from "./format";
import { LOCALE_NAME, LOCALES, setLocale, useI18n } from "./i18n";
import { Tip } from "./Tip";
import { useDebouncedValue } from "./useDebouncedValue";

const MODES: { value: Mode; label: "appearance.mode.system" | "appearance.mode.light" | "appearance.mode.dark" }[] = [
  { value: "system", label: "appearance.mode.system" },
  { value: "light", label: "appearance.mode.light" },
  { value: "dark", label: "appearance.mode.dark" },
];

const BACKGROUND_KEY = {
  default: "bg.default",
  white: "bg.white",
  blue: "bg.blue",
  black: "bg.black",
  red: "bg.red",
  green: "bg.green",
  gold: "bg.gold",
} as const satisfies Record<Background, string>;

/** Lets the user pick light or dark, a background tint, or the art of a card. Saved on this device. */
export function AppearancePage() {
  const { t, locale } = useI18n();
  const appearance = useAppearance();
  const [text, setText] = useState("");
  const q = useDebouncedValue(text.trim(), 300);
  const { data, isFetching, error } = useQuery({
    queryKey: ["cards", "search", "art", q],
    queryFn: ({ signal }) => searchCards({ q, limit: 12 }, signal),
    enabled: q.length >= 2,
  });
  const results = (data ?? []).filter((c) => isArtUrl(c.image?.artCrop));

  // Every printing of the chosen card can have its own art; the list is the one the card dialog already loads.
  const oracleId = appearance.art?.oracleId;
  const printings = useQuery({
    queryKey: ["cards", oracleId, "printings"],
    queryFn: ({ signal }) => fetchPrintings(oracleId!, signal),
    enabled: !!oracleId,
  });
  // Printings that share one picture are offered once, under the first of them.
  const arts = (printings.data ?? []).filter(
    (p, i, all) => isArtUrl(p.image?.artCrop) && all.findIndex((q) => q.image?.artCrop === p.image!.artCrop) === i,
  );

  return (
    <main className="page">
      <h1>{t("appearance.title")}</h1>
      <p className="subtitle">
        {t("appearance.subtitle")}
        <Tip label={t("appearance.tip.label")}>{t("appearance.tip.text")}</Tip>
      </p>

      <section className="panel" aria-labelledby="language-title">
        <h2 id="language-title">{t("appearance.language")}</h2>
        <div className="segmented" role="group" aria-label={t("appearance.language")}>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={locale === l}
              className={locale === l ? "on" : ""}
              onClick={() => setLocale(l)}
            >
              {LOCALE_NAME[l]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="mode-title">
        <h2 id="mode-title">{t("appearance.mode")}</h2>
        <div className="segmented" role="group" aria-label={t("appearance.mode")}>
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={appearance.mode === m.value}
              className={appearance.mode === m.value ? "on" : ""}
              onClick={() => setAppearance({ mode: m.value })}
            >
              {t(m.label)}
            </button>
          ))}
        </div>
        <p className="hint">{t("appearance.mode.hint")}</p>
      </section>

      <section className="panel" aria-labelledby="color-title">
        <h2 id="color-title">{t("appearance.color")}</h2>
        <div className="swatches" role="group" aria-label={t("appearance.color")}>
          {BACKGROUNDS.map((b) => (
            <button
              key={b}
              type="button"
              className={`swatch swatch-${b}${appearance.background === b ? " on" : ""}`}
              aria-pressed={appearance.background === b}
              onClick={() => setAppearance({ background: b, art: null })}
            >
              <span className="swatch-dot" aria-hidden="true" />
              {t(BACKGROUND_KEY[b])}
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="art-title">
        <h2 id="art-title">{t("appearance.art")}</h2>
        <p className="hint">{t("appearance.art.hint")}</p>
        <input
          className="search"
          type="search"
          aria-label={t("appearance.art.search")}
          placeholder={t("appearance.art.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {q.length >= 2 && isFetching && <p className="hint">{t("search.searching")}</p>}
        {q.length >= 2 && error && <p className="error">{t("search.error", { message: error.message })}</p>}
        {q.length >= 2 && !isFetching && !error && results.length === 0 && <p className="hint">{t("appearance.art.none")}</p>}
        <ul className="art-grid">
          {results.map((c) => (
            <li key={c.oracleId}>
              <button
                type="button"
                className="art-tile"
                aria-label={t("appearance.art.use", { name: c.name })}
                onClick={() => setAppearance({ art: { url: c.image!.artCrop, name: c.name, oracleId: c.oracleId } })}
              >
                <img src={c.image!.artCrop} alt="" loading="lazy" />
                <span>{c.name}</span>
              </button>
            </li>
          ))}
        </ul>

        {appearance.art && (
          <div className="art-current">
            <p>
              {t("appearance.art.using")}
              <strong>{appearance.art.name}</strong>.
            </p>
            {oracleId && (
              <div className="printing-art">
                <h3>{t("appearance.printing")}</h3>
                <p className="hint">{t("appearance.printing.hint")}</p>
                {printings.isLoading && <p className="hint">{t("detail.loading")}</p>}
                {printings.error && <p className="error">{printings.error.message}</p>}
                {printings.data && arts.length === 0 && <p className="hint">{t("appearance.art.none")}</p>}
                <ul className="art-grid">
                  {arts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={p.image!.artCrop === appearance.art!.url ? "art-tile on" : "art-tile"}
                        aria-pressed={p.image!.artCrop === appearance.art!.url}
                        aria-label={t("appearance.printing.use", { printing: printingLabel(p) })}
                        onClick={() => setAppearance({ art: { url: p.image!.artCrop, name: appearance.art!.name, oracleId } })}
                      >
                        <img src={p.image!.artCrop} alt="" loading="lazy" />
                        <span>{printingLabel(p)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="slider">
              <span>
                {t("appearance.dimming")}
                <Tip label={t("appearance.dimming.tip.label")}>{t("appearance.dimming.tip.text")}</Tip>
              </span>
              <input
                type="range"
                aria-label={t("appearance.dimming")}
                min={DIMMING_MIN}
                max={DIMMING_MAX}
                value={appearance.dimming}
                onChange={(e) => setAppearance({ dimming: Number(e.target.value) })}
              />
            </div>
            <button type="button" className="link" onClick={() => setAppearance({ art: null })}>
              {t("appearance.art.remove")}
            </button>
          </div>
        )}
      </section>

      <button
        type="button"
        className="link"
        onClick={() => setAppearance({ mode: "system", background: "default", art: null })}
      >
        {t("appearance.reset")}
      </button>
    </main>
  );
}
