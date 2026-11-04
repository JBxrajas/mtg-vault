import { collectionTotals, type CollectionItem } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchMe } from "./auth";
import { fetchCollection, removeFromCollection, updateCollectionItem } from "./collectionApi";
import { formatUsd } from "./format";
import { ImportCollection } from "./ImportCollection";
import { Tip } from "./Tip";

export function CollectionPage() {
  const queryClient = useQueryClient();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const { data: cached, isLoading, error } = useQuery({
    queryKey: ["collection"],
    queryFn: fetchCollection,
    enabled: !!me,
  });
  // Never show cached stacks without a signed-in user (for example right after signing out).
  const items = me ? cached : undefined;
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
        <section className="welcome">
          <h2>Your collection, always at hand</h2>
          <p>
            Create a free account to record every card you own, see what it is worth and import it from Moxfield.
            Already have one? <Link to="/login">Sign in</Link> to see your collection.
          </p>
          <div className="welcome-actions">
            <Link to="/login" search={{ mode: "register" }} className="button">
              Create a free account
            </Link>
          </div>
        </section>
      )}
      {me && isLoading && <p className="hint">Loading…</p>}
      {me && error && <p className="error">{error.message}</p>}
      {actionError && <p className="error">{actionError.message}</p>}

      {me && <ImportCollection />}

      {items && (
        <>
          <div className="stats">
            <div className="stat">
              <b>{totals.copies}</b>
              <span>{totals.copies === 1 ? "card" : "cards"}</span>
            </div>
            <div className="stat">
              <b>{totals.stacks}</b>
              <span>
                {totals.stacks === 1 ? "stack" : "stacks"}
                <Tip label="stacks">
                  A stack is a group of identical copies: same printing, finish and condition. Two foil Bolts from the
                  same set are one stack of 2.
                </Tip>
              </span>
            </div>
            <div className="stat">
              <b>{formatUsd(totals.valueUsd)}</b>
              <span>
                market value
                <Tip label="market value">
                  Sum of the latest Scryfall USD prices of your copies. It is an estimate, not an offer.
                </Tip>
              </span>
            </div>
          </div>
          {totals.unpriced > 0 && <p className="hint">{totals.unpriced} copies without a price are not counted in the value.</p>}
          {items.length === 0 && (
            <p className="hint">
              Nothing here yet. <Link to="/">Search a card</Link> and add it from its printings, or import a CSV above.
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
