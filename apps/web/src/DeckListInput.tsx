import { parseDeckList } from "@mtg-vault/shared";
import { useMemo, useState, type ChangeEvent } from "react";
import { useI18n } from "./i18n";
import { Problems, readFileText } from "./ImportCollection";

/**
 * A text box for a deck list, with a button to load it from a .txt file and a preview of what was read.
 * The parent keeps the text and decides what to do with it (`parseDeckList` gives it the rows).
 */
export function DeckListInput({ text, onText }: { text: string; onText: (text: string, fileName?: string) => void }) {
  const { t } = useI18n();
  const parsed = useMemo(() => parseDeckList(text), [text]);
  const [readError, setReadError] = useState<string | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setReadError(null);
    if (!file) return;
    try {
      onText(await readFileText(file), file.name);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : t("import.readError"));
    }
  }

  return (
    <div className="decklist">
      <p className="hint">{t("decklist.help")}</p>
      <textarea
        aria-label={t("decklist.paste")}
        placeholder={t("decklist.placeholder")}
        rows={8}
        spellCheck={false}
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
      <input type="file" accept=".txt,text/plain" aria-label={t("decklist.file")} onChange={onFile} />
      {readError && (
        <p className="error" role="alert">
          {readError}
        </p>
      )}
      {parsed.rows.length > 0 && (
        <p>{t("decklist.preview", { cards: t("import.cards", { count: parsed.totalCards }) })}</p>
      )}
      <Problems title={t("import.unreadable")} items={parsed.problems} />
    </div>
  );
}
