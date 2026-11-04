import { formatDeckList, parseDeckList, type DeckCardEntry } from "@mtg-vault/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { importDeck } from "./decksApi";
import { DeckListInput } from "./DeckListInput";
import { downloadText, safeFilename } from "./download";
import { useI18n } from "./i18n";
import { Problems } from "./ImportCollection";

/** Export the deck as a text list, and import a list into it. */
export function DeckListTools({ deckId, deckName, cards }: { deckId: string; deckName: string; cards: DeckCardEntry[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const list = useMemo(() => formatDeckList(cards), [cards]);
  const [copy, setCopy] = useState<"copied" | "error" | null>(null);
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseDeckList(text), [text]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = useMutation({
    mutationFn: () => importDeck(deckId, parsed.rows, (done, total) => setProgress({ done, total })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deck", deckId] });
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
    onSettled: () => setProgress(null),
  });

  async function copyList() {
    try {
      await navigator.clipboard.writeText(list);
      setCopy("copied");
    } catch {
      setCopy("error");
    }
  }

  return (
    <details className="import">
      <summary>{t("decklist.title")}</summary>

      <h3>{t("decklist.export")}</h3>
      <div className="row-actions">
        <button type="button" disabled={cards.length === 0} onClick={copyList}>
          {t("decklist.copy")}
        </button>
        <button
          type="button"
          disabled={cards.length === 0}
          onClick={() => downloadText(`${safeFilename(deckName, "deck")}.txt`, `${list}\n`)}
        >
          {t("decklist.download")}
        </button>
      </div>
      {copy === "copied" && (
        <p className="ok" role="status">
          {t("decklist.copied")}
        </p>
      )}
      {copy === "error" && (
        <p className="error" role="alert">
          {t("decklist.copyError")}
        </p>
      )}

      <h3>{t("decklist.import")}</h3>
      <DeckListInput
        text={text}
        onText={(next) => {
          setText(next);
          run.reset();
        }}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={run.isPending || parsed.rows.length === 0}
        onClick={() => run.mutate()}
      >
        {run.isPending && progress
          ? t("import.progress", { done: progress.done, total: progress.total })
          : t("decklist.button", { count: parsed.totalCards })}
      </button>
      {run.error && (
        <p className="error" role="alert">
          {run.error.message}
        </p>
      )}
      {run.data && (
        <div className="import-result" role="status">
          <p className="ok">
            {t("import.done", { created: run.data.created, updated: run.data.updated, unchanged: run.data.unchanged })}
          </p>
          <Problems title={t("import.failed")} items={run.data.problems} />
        </div>
      )}
    </details>
  );
}
