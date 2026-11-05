import type { DeckCardEntry } from "@mtg-vault/shared";
import { useI18n } from "./i18n";
import { ManaCost } from "./ManaCost";

const COLOR_ORDER = ["W", "U", "B", "R", "G"] as const;

/**
 * The deck's commander (or both partners), always at the top of the deck page and sticky while it scrolls,
 * whichever board tab is open. With no commander yet it says how to add one.
 */
export function CommanderBar({ cards }: { cards: DeckCardEntry[] }) {
  const { t } = useI18n();
  const commanders = cards.filter((c) => c.board === "commander");
  if (commanders.length === 0) {
    return (
      <section className="commander-bar" aria-label={t("commanderBar.label")}>
        <span className="hint">{t("analysis.noCommander")}</span>
      </section>
    );
  }
  const identity = COLOR_ORDER.filter((color) => commanders.some((c) => c.colorIdentity.includes(color)));
  return (
    <section className="commander-bar" aria-label={t("commanderBar.label")}>
      {commanders.map((c) => (c.image ? <img key={c.oracleId} src={c.image.artCrop} alt="" loading="lazy" /> : null))}
      <div className="commander-names">
        <small>{t("commanderBar.title")}</small>
        {commanders.map((c) => c.name).join(" · ")}
      </div>
      {identity.length > 0 && <ManaCost cost={identity.map((color) => `{${color}}`).join("")} />}
    </section>
  );
}
