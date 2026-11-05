import { conditionSchema, type CollectionItem, type UpdateCollectionItem } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPrintings } from "./api";
import { updateCollectionItem } from "./collectionApi";
import { printingLabel, releaseYear } from "./format";
import { useI18n } from "./i18n";

const FINISH_KEY = { nonfoil: "finish.nonfoil", foil: "finish.foil", etched: "finish.etched" } as const;

/** Changes what a stack of the collection is: its edition (printing), finish, condition and language. */
export function StackEditor({ item, onDone }: { item: CollectionItem; onDone: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: printings, isLoading, error: loadError } = useQuery({
    queryKey: ["printings", item.oracleId],
    queryFn: ({ signal }) => fetchPrintings(item.oracleId, signal),
    staleTime: 5 * 60_000,
  });
  const [printingId, setPrintingId] = useState(item.printingId);
  const [finish, setFinish] = useState<string>(item.finish);
  const [condition, setCondition] = useState<string>(item.condition);
  const [language, setLanguage] = useState(item.language);

  const chosen = printings?.find((p) => p.id === printingId);
  // The printing may not come in the finish the stack has: fall back to one it does.
  const finishes = chosen?.finishes.length ? chosen.finishes : [item.finish];
  const effectiveFinish = finishes.includes(finish) ? finish : finishes[0]!;

  const save = useMutation({
    mutationFn: () => {
      const patch: UpdateCollectionItem = {};
      if (printingId !== item.printingId) patch.printingId = printingId;
      if (effectiveFinish !== item.finish) patch.finish = effectiveFinish as CollectionItem["finish"];
      if (condition !== item.condition) patch.condition = condition as CollectionItem["condition"];
      if (language.trim() !== item.language) patch.language = language.trim();
      return Object.keys(patch).length ? updateCollectionItem(item.id, patch) : Promise.resolve(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collection"] });
      onDone();
    },
  });

  return (
    <form
      className="stack-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="wide-field">
        {t("stack.edition")}
        <select value={printingId} disabled={isLoading} onChange={(e) => {
          setPrintingId(e.target.value);
          const next = printings?.find((p) => p.id === e.target.value);
          if (next) setLanguage(next.lang);
        }}>
          {!chosen && <option value={item.printingId}>{printingLabel(item)}</option>}
          {printings?.map((p) => (
            <option key={p.id} value={p.id}>
              {printingLabel(p)} · {releaseYear(p.releasedAt)} · {p.lang}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("add.finish")}
        <select value={effectiveFinish} onChange={(e) => setFinish(e.target.value)}>
          {finishes.map((f) => (
            <option key={f} value={f}>
              {t(FINISH_KEY[f as keyof typeof FINISH_KEY] ?? "finish.nonfoil")}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("add.condition")}
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          {conditionSchema.options.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        {t("stack.language")}
        <input value={language} maxLength={5} onChange={(e) => setLanguage(e.target.value)} />
      </label>
      <div className="stack-editor-actions">
        <button type="submit" disabled={save.isPending || language.trim().length < 2}>
          {t("common.save")}
        </button>
        <button type="button" className="link" onClick={onDone}>
          {t("common.cancel")}
        </button>
      </div>
      <p className="hint">{t("stack.mergeHint")}</p>
      {(save.error || loadError) && <p className="error">{(save.error ?? loadError)!.message}</p>}
    </form>
  );
}
