import { colorIdentityName, dropCommanderRows, parseDeckList, type DeckImportResult } from "@mtg-vault/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CommanderChooser, type CommanderChoice } from "./CommanderChooser";
import { addDeckCard, createDeck, importDeck } from "./decksApi";
import { DeckListInput } from "./DeckListInput";
import { useI18n } from "./i18n";
import { Problems } from "./ImportCollection";
import { ManaCost } from "./ManaCost";

type Step = 1 | 2 | 3;
const STEPS = [
  { step: 1, key: "wizard.step.name" },
  { step: 2, key: "wizard.step.commander" },
  { step: 3, key: "wizard.step.cards" },
] as const;

/**
 * A guided way to start a Commander deck: the name, then the commander (with the art you pick shown large), then the
 * other 99 cards, pasted as a text list or left for later. The commander is checked before anything else, and a list
 * that repeats it does not add it twice.
 */
export function NewCommanderDeck() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<CommanderChoice | null>(null);
  const [later, setLater] = useState(false);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const parsed = useMemo(() => parseDeckList(text), [text]);
  const { rows, skipped } = useMemo(() => dropCommanderRows(parsed.rows, choice ? [choice.card.name] : []), [parsed.rows, choice]);
  const count = rows.reduce((n, r) => n + r.quantity, 0);

  const create = useMutation({
    mutationFn: async (): Promise<{ deckId: string; result: DeckImportResult | null }> => {
      const deck = await createDeck({ name: name.trim(), format: "commander" });
      await addDeckCard(deck.id, {
        oracleId: choice!.card.oracleId,
        board: "commander",
        quantity: 1,
        ...(choice!.printingId ? { printingId: choice!.printingId } : {}),
      });
      const result = !later && rows.length > 0 ? await importDeck(deck.id, rows, (done, total) => setProgress({ done, total })) : null;
      return { deckId: deck.id, result };
    },
    onSuccess: async ({ deckId, result }) => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      if (!result || result.problems.length === 0) await navigate({ to: "/decks/$deckId", params: { deckId } });
    },
    onSettled: () => setProgress(null),
  });

  const identity = choice?.card.colorIdentity ?? []; // may be missing from an older API during a deploy

  return (
    <details className="wizard">
      <summary>{t("wizard.title")}</summary>
      <ol className="steps" aria-label={t("wizard.steps")}>
        {STEPS.map((s) => (
          <li key={s.step} aria-current={s.step === step ? "step" : undefined} className={s.step === step ? "on" : s.step < step ? "done" : undefined}>
            <span className="step-n">{s.step < step ? "✓" : s.step}</span> {t(s.key)}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form
          className="wizard-step"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setStep(2);
          }}
        >
          <label>
            {t("wizard.name")}
            <input value={name} maxLength={100} placeholder={t("decks.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            {t("wizard.next")}
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="wizard-step">
          <p className="hint">{t("wizard.commanderHint")}</p>
          <CommanderChooser
            onChoose={(c) => {
              setChoice(c);
              setStep(3);
            }}
          />
          <button type="button" className="link" onClick={() => setStep(1)}>
            {t("wizard.back")}
          </button>
        </div>
      )}

      {step === 3 && choice && (
        <div className="wizard-step">
          <section className="wizard-commander" aria-label={t("wizard.yourCommander")}>
            {choice.image && <img src={choice.image.normal} alt={choice.card.name} />}
            <div>
              <h3>{choice.card.name}</h3>
              <p className="identity-line">
                <ManaCost cost={identity.map((c) => `{${c}}`).join("")} /> <b>{colorIdentityName(identity)}</b>
              </p>
              <p className="sub">{name.trim()}</p>
              <button type="button" className="link" onClick={() => setStep(2)}>
                {t("wizard.change")}
              </button>
            </div>
          </section>

          <h3>{t("wizard.cards")}</h3>
          <div className="row-actions" role="group" aria-label={t("wizard.cards")}>
            <button type="button" aria-pressed={!later} className={!later ? "tab on" : "tab"} onClick={() => setLater(false)}>
              {t("wizard.paste")}
            </button>
            <button type="button" aria-pressed={later} className={later ? "tab on" : "tab"} onClick={() => setLater(true)}>
              {t("wizard.later")}
            </button>
          </div>
          {later ? (
            <p className="hint">{t("wizard.laterHint")}</p>
          ) : (
            <>
              <DeckListInput text={text} onText={(next) => { setText(next); create.reset(); }} />
              {rows.length > 0 && <p>{t("wizard.count", { count, target: 99 })}</p>}
              {skipped > 0 && (
                <p className="hint" role="status">
                  {t("decklist.skippedCommander", { count: skipped })}
                </p>
              )}
            </>
          )}

          <button type="button" className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending && progress ? t("import.progress", { done: progress.done, total: progress.total }) : t("wizard.create")}
          </button>
          <button type="button" className="link" onClick={() => setStep(2)}>
            {t("wizard.back")}
          </button>
          {create.error && (
            <p className="error" role="alert">
              {create.error.message}
            </p>
          )}
          {create.data?.result && create.data.result.problems.length > 0 && (
            <div className="import-result" role="status">
              <p className="ok">
                {t("import.done", { created: create.data.result.created, updated: create.data.result.updated, unchanged: create.data.result.unchanged })}{" "}
                <Link to="/decks/$deckId" params={{ deckId: create.data.deckId }}>
                  {t("decks.import.open")}
                </Link>
              </p>
              <Problems title={t("import.failed")} items={create.data.result.problems} />
            </div>
          )}
        </div>
      )}
    </details>
  );
}
