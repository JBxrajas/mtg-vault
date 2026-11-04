import { conditionSchema, type PrintingSummary } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fetchMe } from "./auth";
import { addToCollection } from "./collectionApi";
import { printingLabel } from "./format";
import { useI18n } from "./i18n";
import { Tip } from "./Tip";

const FINISH_KEY = { nonfoil: "finish.nonfoil", foil: "finish.foil", etched: "finish.etched" } as const;

/** Form to add copies of the selected printing to the signed-in user's collection. */
export function AddToCollection({ printing }: { printing: PrintingSummary }) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal), staleTime: 60_000 });
  const [finish, setFinish] = useState(printing.finishes[0] ?? "nonfoil");
  const [condition, setCondition] = useState("NM");
  // Kept as text so the field can be emptied and retyped; clamped when used and on blur.
  const [quantityText, setQuantityText] = useState("1");
  const quantity = Math.max(1, Math.min(9999, Math.trunc(Number(quantityText)) || 1));

  // The selected printing changed: its finishes may differ.
  const finishes = printing.finishes.length ? printing.finishes : ["nonfoil"];
  const effectiveFinish = finishes.includes(finish) ? finish : finishes[0]!;

  const add = useMutation({
    mutationFn: () =>
      addToCollection({
        printingId: printing.id,
        quantity,
        finish: effectiveFinish as "nonfoil" | "foil" | "etched",
        condition: condition as "NM",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collection"] }),
  });

  if (!me) {
    return (
      <p className="hint">
        <Link to="/login">{t("auth.signIn")}</Link>
        {t("add.signInTo")}
      </p>
    );
  }

  return (
    <form
      className="add-form"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <strong>
        {t("add.title", { printing: printingLabel(printing) })}
        <Tip label={t("add.tip.label")}>{t("add.tip.text")}</Tip>
      </strong>
      <div className="add-fields">
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
          {t("add.qty")}
          <input
            type="number"
            min={1}
            max={9999}
            value={quantityText}
            onChange={(e) => setQuantityText(e.target.value)}
            onBlur={() => setQuantityText(String(quantity))}
          />
        </label>
        <button type="submit" disabled={add.isPending}>
          {add.isPending ? t("add.adding") : t("add.add")}
        </button>
      </div>
      {add.isSuccess && (
        <p className="ok">
          {t("add.added", { count: add.data.quantity })} <Link to="/collection">{t("add.myCollection")}</Link>
        </p>
      )}
      {add.error && <p className="error">{add.error.message}</p>}
    </form>
  );
}
