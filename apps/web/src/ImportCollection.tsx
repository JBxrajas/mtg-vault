import { parseCollectionCsv, type ImportResult, type ParsedImport } from "@mtg-vault/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { importCollection } from "./collectionApi";
import { useI18n } from "./i18n";

/** Reads a File as text. FileReader rather than `file.text()` so it also works in older browsers. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsText(file);
  });
}

const SHOWN = 25;

export function Problems({ title, items }: { title: string; items: ImportResult["problems"] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <details className="import-list">
      <summary>
        {title} ({items.length})
      </summary>
      <ul>
        {items.slice(0, SHOWN).map((p, i) => (
          <li key={`${p.line}-${i}`}>
            <strong>{t("import.line", { line: p.line })}</strong> · {p.name}: {p.reason}
          </li>
        ))}
        {items.length > SHOWN && <li>{t("import.more", { count: items.length - SHOWN })}</li>}
      </ul>
    </details>
  );
}

/** Import a collection from a CSV export (Moxfield, or a file with similar headers). */
export function ImportCollection() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = useMutation({
    mutationFn: (rows: ParsedImport["rows"]) => importCollection(rows, (done, total) => setProgress({ done, total })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collection"] }),
    onSettled: () => setProgress(null),
  });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    run.reset();
    setParsed(null);
    setReadError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      setParsed(parseCollectionCsv(await readFileText(file)));
    } catch (err) {
      setReadError(err instanceof Error ? err.message : t("import.readError"));
    }
  }

  return (
    <details className="import">
      <summary>{t("import.title")}</summary>
      <p className="hint">
        {t("import.help1")}
      </p>
      <p className="hint">
        {t("import.help2.before")}
        <strong>{t("import.help2.strong")}</strong>
        {t("import.help2.after")}
      </p>
      <input type="file" accept=".csv,text/csv" aria-label={t("import.file")} onChange={onFile} />
      {readError && (
        <p className="error" role="alert">
          {readError}
        </p>
      )}

      {parsed && !run.data && (
        <div className="import-preview">
          <p>
            <strong>{fileName}</strong>:{" "}
            {t("import.preview", {
              lines: t("import.lines", { count: parsed.rows.length }),
              cards: t("import.cards", { count: parsed.totalCards }),
            })}
            {parsed.skipped > 0 && t("import.skipped", { count: parsed.skipped })}.
          </p>
          <Problems title={t("import.unreadable")} items={parsed.problems} />
          {parsed.ignoredColumns.length > 0 && (
            <p className="hint">{t("import.ignored", { columns: parsed.ignoredColumns.join(", ") })}</p>
          )}
          <button type="button" className="btn-primary" disabled={run.isPending || parsed.rows.length === 0} onClick={() => run.mutate(parsed.rows)}>
            {run.isPending && progress
              ? t("import.progress", { done: progress.done, total: progress.total })
              : t("import.button", { count: parsed.rows.length })}
          </button>
        </div>
      )}

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
          <Problems title={t("import.adjusted")} items={run.data.adjusted} />
          <Problems title={t("import.failed")} items={run.data.problems} />
        </div>
      )}
    </details>
  );
}
