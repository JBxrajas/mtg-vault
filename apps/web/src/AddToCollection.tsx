import { conditionSchema, type PrintingSummary } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fetchMe } from "./auth";
import { addToCollection } from "./collectionApi";
import { printingLabel } from "./format";
import { Tip } from "./Tip";

/** Form to add copies of the selected printing to the signed-in user's collection. */
export function AddToCollection({ printing }: { printing: PrintingSummary }) {
  const queryClient = useQueryClient();
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
        <Link to="/login">Sign in</Link> to add cards to your collection.
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
        Add {printingLabel(printing)}
        <Tip label="finish, condition and quantity">
          Finish: nonfoil is the normal card, foil has a shiny layer, etched is a matte metallic foil. Condition: NM near
          mint, LP lightly played, MP moderately played, HP heavily played, DMG damaged; it is for your records and the
          price shown does not change with it. Qty: copies of this exact card you own.
        </Tip>
      </strong>
      <div className="add-fields">
        <label>
          Finish
          <select value={effectiveFinish} onChange={(e) => setFinish(e.target.value)}>
            {finishes.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Condition
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {conditionSchema.options.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Qty
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
          {add.isPending ? "Adding…" : "Add"}
        </button>
      </div>
      {add.isSuccess && (
        <p className="ok">
          Added. You now own {add.data.quantity} of this exact copy. <Link to="/collection">My collection</Link>
        </p>
      )}
      {add.error && <p className="error">{add.error.message}</p>}
    </form>
  );
}
