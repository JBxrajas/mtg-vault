import { colorSchema, type CardSearchResult, type Color } from "@mtg-vault/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchCards } from "./api";
import { useI18n } from "./i18n";
import { CardDetail } from "./CardDetail";
import { ManaCost } from "./ManaCost";
import { Tip } from "./Tip";
import { Welcome } from "./Welcome";
import { useDebouncedValue } from "./useDebouncedValue";

const COLORS = colorSchema.options;
const COLOR_KEY = {
  W: "color.W",
  U: "color.U",
  B: "color.B",
  R: "color.R",
  G: "color.G",
} as const;

/** Card types people search for most; the type box accepts any word of the type line. */
export const CARD_TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"] as const;
const TYPE_KEY = {
  Creature: "type.Creature",
  Instant: "type.Instant",
  Sorcery: "type.Sorcery",
  Artifact: "type.Artifact",
  Enchantment: "type.Enchantment",
  Planeswalker: "type.Planeswalker",
  Land: "type.Land",
  Battle: "type.Battle",
} as const;

/** Plain-words summary of the color buttons, so it is clear what they do. */
export function describeColors(colors: Color[], t: ReturnType<typeof useI18n>["t"]): string {
  if (colors.length === 0) return t("search.colors.none");
  const names = colors.map((c) => t(COLOR_KEY[c]));
  const list = names.length === 1 ? names[0]! : t("search.colors.and", { head: names.slice(0, -1).join(", "), last: names[names.length - 1]! });
  return colors.length === 1 ? t("search.colors.one", { list }) : t("search.colors.all", { list });
}

export function SearchPage() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const [colors, setColors] = useState<Color[]>([]);
  const [preview, setPreview] = useState<CardSearchResult | null>(null);
  const q = useDebouncedValue(text.trim(), 300);
  const typeFilter = useDebouncedValue(type.trim(), 300);

  const enabled = q.length >= 2;
  const { data, isFetching, error } = useQuery({
    queryKey: ["cards", "search", q, typeFilter, colors],
    queryFn: ({ signal }) =>
      searchCards({ q, type: typeFilter || undefined, colors, limit: 30 }, signal),
    enabled,
    placeholderData: (previous) => previous,
  });

  const toggle = (c: Color) =>
    setColors((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <main className="page">
      <h1>{t("search.title")}</h1>
      <p className="subtitle">
        {t("search.subtitle")}
        <Tip label={t("search.tip.label")}>{t("search.tip.text")}</Tip>
      </p>
      <Welcome />

      <div className="searchbox">
        <input
          className="search"
          type="search"
          placeholder={t("search.placeholder")}
          aria-label={t("search.cardName")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className="filters">
          <div className="filter">
            <span className="filter-title">
              {t("search.type.title")}
              <Tip label={t("search.type.tip.label")}>{t("search.type.tip.text")}</Tip>
            </span>
            <input
              type="text"
              placeholder={t("search.type.placeholder")}
              aria-label={t("search.type.aria")}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <div className="chips" role="group" aria-label={t("search.type.common")}>
              {CARD_TYPES.map((ct) => {
                const on = type.trim().toLowerCase() === ct.toLowerCase();
                return (
                  <button
                    key={ct}
                    type="button"
                    className={on ? "chip on" : "chip"}
                    aria-pressed={on}
                    onClick={() => setType(on ? "" : ct)}
                  >
                    {t(TYPE_KEY[ct])}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="filter">
            <span className="filter-title">
              {t("search.colors.title")}
              <Tip label={t("search.colors.tip.label")}>{t("search.colors.tip.text")}</Tip>
            </span>
            <div className="colors" role="group" aria-label={t("search.colors.aria")}>
              {COLORS.map((c) => (
                <div key={c} className="color-item">
                  <button
                    type="button"
                    className={`color pip-${c.toLowerCase()}${colors.includes(c) ? " on" : ""}`}
                    aria-pressed={colors.includes(c)}
                    title={t(COLOR_KEY[c])}
                    onClick={() => toggle(c)}
                  >
                    {c}
                  </button>
                  <span className="color-name" aria-hidden="true">
                    {t(COLOR_KEY[c])}
                  </span>
                </div>
              ))}
            </div>
            <p className="hint filter-summary">{describeColors(colors, t)}</p>
          </div>
        </div>
      </div>

      {!enabled && <p className="hint">{t("search.min")}</p>}
      {enabled && error && <p className="error">{t("search.error", { message: error.message })}</p>}
      {enabled && isFetching && <p className="hint">{t("search.searching")}</p>}
      {enabled && !isFetching && !error && data?.length === 0 && <p className="hint">{t("search.none")}</p>}

      <ul className="results">
        {enabled &&
          data?.map((card) => (
            <li key={card.oracleId} className="tile">
              <button
                type="button"
                className={card.image ? "tile-btn" : "tile-btn empty"}
                aria-label={t("search.show", { name: card.name })}
                onClick={() => setPreview(card)}
              >
                {card.image ? <img src={card.image.small} alt="" loading="lazy" /> : t("search.noImage")}
              </button>
              <div className="tile-info">
                <div className="name">{card.name}</div>
                <ManaCost cost={card.manaCost} />
                <div className="type">{card.typeLine}</div>
              </div>
            </li>
          ))}
      </ul>

      {preview && <CardDetail card={preview} onClose={() => setPreview(null)} />}

      <footer className="credit">
        {t("credit.before")}
        <a href="https://scryfall.com">Scryfall</a>
        {t("credit.after")}
      </footer>
    </main>
  );
}
