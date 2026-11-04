import { deckFormatSchema, parseDeckList, type DeckFormat, type DeckImportResult, type DeckSummary } from "@mtg-vault/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createDeck, importDeck } from "./decksApi";
import { DeckListInput } from "./DeckListInput";
import { formatLabel } from "./DecksPage";
import { useI18n } from "./i18n";
import { Problems } from "./ImportCollection";

/** Create a deck from a pasted or uploaded list. */
export function ImportDeck() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [format, setFormat] = useState<DeckFormat>("casual");
  const parsed = useMemo(() => parseDeckList(text), [text]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = useMutation({
    mutationFn: async (): Promise<{ deck: DeckSummary; result: DeckImportResult }> => {
      const deck = await createDeck({ name: name.trim(), format });
      const result = await importDeck(deck.id, parsed.rows, (done, total) => setProgress({ done, total }));
      return { deck, result };
    },
    onSuccess: async ({ deck, result }) => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      // With nothing to report, go straight to the deck; otherwise stay so the problems can be read.
      if (result.problems.length === 0) await navigate({ to: "/decks/$deckId", params: { deckId: deck.id } });
    },
    onSettled: () => setProgress(null),
  });

  return (
    <details className="import">
      <summary>{t("decks.import.title")}</summary>
      <div className="new-deck">
        <input
          aria-label={t("decks.import.name")}
          placeholder={t("decks.namePlaceholder")}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
        <select aria-label={t("decks.import.format")} value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)}>
          {deckFormatSchema.options.map((f) => (
            <option key={f} value={f}>
              {formatLabel(f)}
            </option>
          ))}
        </select>
      </div>
      <DeckListInput
        text={text}
        onText={(next, fileName) => {
          setText(next);
          run.reset();
          if (fileName && !name.trim()) setName(fileName.replace(/\.[^.]+$/, "").slice(0, 100));
        }}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={run.isPending || parsed.rows.length === 0 || !name.trim()}
        onClick={() => run.mutate()}
      >
        {run.isPending && progress
          ? t("import.progress", { done: progress.done, total: progress.total })
          : t("decks.import.button")}
      </button>
      {run.error && (
        <p className="error" role="alert">
          {run.error.message}
        </p>
      )}
      {run.data && run.data.result.problems.length > 0 && (
        <div className="import-result" role="status">
          <p className="ok">
            {t("import.done", {
              created: run.data.result.created,
              updated: run.data.result.updated,
              unchanged: run.data.result.unchanged,
            })}{" "}
            <Link to="/decks/$deckId" params={{ deckId: run.data.deck.id }}>
              {t("decks.import.open")}
            </Link>
          </p>
          <Problems title={t("import.failed")} items={run.data.result.problems} />
        </div>
      )}
    </details>
  );
}
