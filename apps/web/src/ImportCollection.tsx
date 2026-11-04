import { parseCollectionCsv, type ImportResult, type ParsedImport } from "@mtg-vault/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { importCollection } from "./collectionApi";

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

function Problems({ title, items }: { title: string; items: ImportResult["problems"] }) {
  if (items.length === 0) return null;
  return (
    <details className="import-list">
      <summary>
        {title} ({items.length})
      </summary>
      <ul>
        {items.slice(0, SHOWN).map((p, i) => (
          <li key={`${p.line}-${i}`}>
            <strong>Line {p.line}</strong> · {p.name}: {p.reason}
          </li>
        ))}
        {items.length > SHOWN && <li>…and {items.length - SHOWN} more.</li>}
      </ul>
    </details>
  );
}

/** Import a collection from a CSV export (Moxfield, or a file with similar headers). */
export function ImportCollection() {
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
      setReadError(err instanceof Error ? err.message : "Could not read the file");
    }
  }

  return (
    <details className="import">
      <summary>Import from CSV</summary>
      <p className="hint">
        Export your collection from Moxfield as a CSV file and choose it here. Files from other tools work if
        their headers are similar (name, count, set, collector number, condition, foil…).
      </p>
      <p className="hint">
        The count in the file <strong>sets</strong> the quantity of each stack, so importing the same file again
        changes nothing. Stacks that are not in the file are left alone.
      </p>
      <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={onFile} />
      {readError && (
        <p className="error" role="alert">
          {readError}
        </p>
      )}

      {parsed && !run.data && (
        <div className="import-preview">
          <p>
            <strong>{fileName}</strong>: {parsed.rows.length} {parsed.rows.length === 1 ? "line" : "lines"},{" "}
            {parsed.totalCards} {parsed.totalCards === 1 ? "card" : "cards"} ready to import
            {parsed.skipped > 0 && ` (${parsed.skipped} ${parsed.skipped === 1 ? "proxy" : "proxies"} skipped)`}.
          </p>
          <Problems title="Lines that cannot be read" items={parsed.problems} />
          {parsed.ignoredColumns.length > 0 && (
            <p className="hint">Columns not used: {parsed.ignoredColumns.join(", ")}.</p>
          )}
          <button type="button" className="btn-primary" disabled={run.isPending || parsed.rows.length === 0} onClick={() => run.mutate(parsed.rows)}>
            {run.isPending && progress ? `Importing… ${progress.done} / ${progress.total}` : `Import ${parsed.rows.length} ${parsed.rows.length === 1 ? "line" : "lines"}`}
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
            Done: {run.data.created} new, {run.data.updated} updated, {run.data.unchanged} already up to date.
          </p>
          <Problems title="Imported with a change" items={run.data.adjusted} />
          <Problems title="Not imported" items={run.data.problems} />
        </div>
      )}
    </details>
  );
}
