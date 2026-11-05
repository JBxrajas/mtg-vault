import { deckTargetSize, groupByCategory, type DeckCardEntry, type DeckDetail } from "@mtg-vault/shared";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { formatLabel } from "./DecksPage";
import { useI18n } from "./i18n";

/**
 * The top of a deck: the commander's art as the background, the name, how full the deck is (a bar that turns green
 * when it reaches the size of its format and red when it goes over) and how the cards divide among types (a bar of
 * coloured segments with a legend). `issues` is the number of cards with a rule warning.
 */
export function DeckHero({ deck, cards, count, issues }: { deck: DeckDetail["deck"]; cards: DeckCardEntry[]; count: number; issues: number }) {
  const { t } = useI18n();
  const target = deckTargetSize(deck.format);
  const art = cards.find((c) => c.board === "commander" && c.image)?.image?.artCrop;
  const groups = groupByCategory(cards);
  const total = groups.reduce((n, g) => n + g.count, 0);
  const state = target && count > target ? "over" : target && count === target ? "done" : "";
  return (
    <header className={art ? "deck-hero has-art" : "deck-hero"} style={art ? ({ "--hero-art": `url("${art}")` } as CSSProperties) : undefined}>
      <Link to="/decks" className="hero-back">
        {t("deck.back")}
      </Link>
      <h1>{deck.name}</h1>
      <p className="deck-meta">
        <span className="badge">{formatLabel(deck.format)}</span>
        <span className={target && count > target ? "count over" : "count"}>{t("decks.cardCount", { count, target: target ? ` / ${target}` : "" })}</span>
        {deck.isPublic && <span className="badge">{t("deck.public")}</span>}
        {issues > 0 && <span className="badge warn">⚠ {t("deck.problemsIn", { count: issues })}</span>}
      </p>
      {deck.description && <p className="subtitle">{deck.description}</p>}
      {target && (
        <div className={`deck-progress ${state}`} role="progressbar" aria-label={t("decks.progress")} aria-valuemin={0} aria-valuemax={target} aria-valuenow={count}>
          <i style={{ width: `${Math.min(1, count / target) * 100}%` }} />
        </div>
      )}
      {total > 0 && (
        <div className="type-split">
          <div className="type-bar" aria-hidden="true">
            {groups.map((g) => (
              <span key={g.category} data-cat={g.category} style={{ flexGrow: g.count }} title={`${t(`category.${g.category}`)}: ${g.count}`} />
            ))}
          </div>
          <ul className="type-legend" aria-label={t("deck.composition")}>
            {groups.map((g) => (
              <li key={g.category} data-cat={g.category}>
                <span className="dot" aria-hidden="true" />
                {t(`category.${g.category}`)} <b>{g.count}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
