import { collectionTotals, type CollectionItem } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchMe } from "./auth";
import { fetchCollection, removeFromCollection, updateCollectionItem } from "./collectionApi";
import { formatUsd } from "./format";

export function CollectionPage() {
  const queryClient = useQueryClient();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const { data: items, isLoading, error } = useQuery({
    queryKey: ["collection"],
    queryFn: fetchCollection,
    enabled: !!me,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["collection"] });
  const setQuantity = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => updateCollectionItem(id, { quantity }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: removeFromCollection, onSuccess: refresh });

  const totals = collectionTotals(items ?? []);
  const actionError = setQuantity.error ?? remove.error;

  return (
    <main className="page">
      <h1>My collection</h1>

      {!loadingMe && !me && (
        <p className="hint">
          <Link to="/login">Sign in</Link> to see your collection.
        </p>
      )}
      {isLoading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error.message}</p>}
      {actionError && <p className="error">{actionError.message}</p>}

      {items && (
        <>
          <div className="stats">
            <div className="stat">
              <b>{totals.copies}</b>
              <span>{totals.copies === 1 ? "card" : "cards"}</span>
            </div>
            <div className="stat">
              <b>{totals.stacks}</b>
              <span>{totals.stacks === 1 ? "stack" : "stacks"}</span>
            </div>
            <div className="stat">
              <b>{formatUsd(totals.valueUsd)}</b>
              <span>market value</span>
            </div>
          </div>
          {totals.unpriced > 0 && <p className="hint">{totals.unpriced} copies without a price are not counted in the value.</p>}
          {items.length === 0 && (
            <p className="hint">
              Nothing here yet. <Link to="/">Search a card</Link> and add it from its printings.
            </p>
          )}
          <ul className="stacks">
            {items.map((item) => (
              <StackRow
                key={item.id}
                item={item}
                busy={setQuantity.isPending || remove.isPending}
                onQuantity={(quantity) => setQuantity.mutate({ id: item.id, quantity })}
                onRemove={() => remove.mutate(item.id)}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function StackRow(props: {
  item: CollectionItem;
  busy: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { item } = props;
  return (
    <li className="stack">
      {item.image ? (
        <img src={item.image.small} alt="" loading="lazy" />
      ) : (
        <div className="thumb-ph" aria-hidden="true" />
      )}
      <div>
        <div className="name">{item.name}</div>
        <div className="sub">
          {item.setName} ({item.setCode.toUpperCase()}) #{item.collectorNumber} · {item.finish} · {item.condition}
          {item.language !== "en" ? ` · ${item.language}` : ""}
        </div>
        <div className="sub">
          {item.unitPrice != null
            ? `${formatUsd(item.unitPrice)} each · ${formatUsd(item.unitPrice * item.quantity)}`
            : "No price yet"}
        </div>
      </div>
      <div className="qty">
        <button type="button" aria-label="One less" disabled={props.busy || item.quantity <= 1} onClick={() => props.onQuantity(item.quantity - 1)}>
          −
        </button>
        <output aria-label="Quantity">{item.quantity}</output>
        <button type="button" aria-label="One more" disabled={props.busy} onClick={() => props.onQuantity(item.quantity + 1)}>
          +
        </button>
        <span className="spacer" />
        <button type="button" className="link" disabled={props.busy} onClick={props.onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}
