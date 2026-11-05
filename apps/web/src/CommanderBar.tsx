import { colorIdentityName, colorWords, hasPartnerAbility, type DeckCardEntry } from "@mtg-vault/shared";
import { CommanderChooser, type CommanderChoice } from "./CommanderChooser";
import { useI18n } from "./i18n";
import { ManaCost } from "./ManaCost";

const COLOR_ORDER = ["W", "U", "B", "R", "G"] as const;

/**
 * The deck's commander (or both partners), always at the top of the deck page and sticky while it scrolls,
 * whichever board tab is open. With no commander yet it is the first step: a visual chooser. A commander that can
 * have a partner offers a second chooser.
 */
export function CommanderBar({ cards, busy, onChoose }: { cards: DeckCardEntry[]; busy: boolean; onChoose: (choice: CommanderChoice) => void }) {
  const { t } = useI18n();
  const commanders = cards.filter((c) => c.board === "commander");
  if (commanders.length === 0) {
    return (
      <section className="commander-setup" aria-label={t("commanderBar.label")}>
        <h2 className="group-title">{t("commanderBar.choose")}</h2>
        <p className="hint">{t("commanderBar.chooseHint")}</p>
        <CommanderChooser busy={busy} onChoose={onChoose} />
      </section>
    );
  }
  const identity = COLOR_ORDER.filter((color) => commanders.some((c) => c.colorIdentity.includes(color)));
  const canAddSecond = commanders.length === 1 && hasPartnerAbility(commanders[0]!);
  return (
    <>
      <section className="commander-bar" aria-label={t("commanderBar.label")}>
        {commanders.map((c) => (c.image ? <img key={c.oracleId} src={c.image.artCrop} alt="" loading="lazy" /> : null))}
        <div className="commander-names">
          <small>{t("commanderBar.title")}</small>
          {commanders.map((c) => c.name).join(" · ")}
        </div>
        <div className="commander-identity" title={colorWords(identity).join(", ") || undefined}>
          <ManaCost cost={identity.map((color) => `{${color}}`).join("")} />
          <small>{colorIdentityName(identity)}</small>
        </div>
      </section>
      {canAddSecond && (
        <details className="partner-chooser">
          <summary>{t("commanderBar.addSecond")}</summary>
          <CommanderChooser existing={commanders} busy={busy} onChoose={onChoose} />
        </details>
      )}
    </>
  );
}
