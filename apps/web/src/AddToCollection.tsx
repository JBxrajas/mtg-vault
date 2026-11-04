import { conditionSchema, type PrintingSummary } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fetchMe } from "./auth";
import { addToCollection } from "./collectionApi";
import { printingLabel } from "./format";

/** Form to add copies of the selected printing to the signed-in user's collection. */
export function AddToCollection({ printing }: { printing: PrintingSummary }) {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal), staleTime: 60_000 });
  const [finish, setFinish] = useState(printing.finishes[0] ?? "nonfoil");
  const [condition, setCondition] = useState("NM");
  const [quantity, setQuantity] = useState(1);

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
      <strong>Add {printingLabel(printing)}</strong>
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
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(9999, Number(e.target.value) || 1)))}
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
