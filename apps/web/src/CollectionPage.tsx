import {
  collectionToCsv,
  collectionTotals,
  emptyFilters,
  filterCollection,
  sortCollection,
  activeFilterCount,
  type CollectionFilters,
  type CollectionItem,
  type CollectionSort,
} from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CollectionFilterBar } from "./CollectionFilters";
import { CardPreview } from "./CardPreview";
import { fetchMe } from "./auth";
import { fetchCollection, removeFromCollection, updateCollectionItem } from "./collectionApi";
import { downloadText } from "./download";
import { artHref } from "./art";
import { CurrencyControl } from "./CurrencyControl";
import { formatMoney, useCurrency } from "./currency";
import { useI18n } from "./i18n";
import { ImportCollection } from "./ImportCollection";
import { Tip } from "./Tip";

export function CollectionPage() {
  const { t } = useI18n();
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
  // Optimistic: the number changes on tap and the request follows. `scope` makes taps run one after another, so
  // two quick taps cannot reach the server out of order. The list is re-read once the last one is done.
  const setQuantity = useMutation({
    mutationKey: ["collection", "quantity"],
    scope: { id: "collection-quantity" },
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => updateCollectionItem(id, { quantity }),
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ["collection"] });
      const previous = queryClient.getQueryData<CollectionItem[]>(["collection"]);
      queryClient.setQueryData<CollectionItem[]>(["collection"], (list) =>
        list?.map((i) => (i.id === id ? { ...i, quantity } : i)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["collection"], context.previous);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["collection", "quantity"] }) <= 1) void refresh();
    },
  });
  const remove = useMutation({ mutationFn: removeFromCollection, onSuccess: refresh });

  const [filters, setFilters] = useState<CollectionFilters>(emptyFilters);
  const [sort, setSort] = useState<CollectionSort>("name");
  const [desc, setDesc] = useState(false);
  const [view, setView] = useState<"list" | "art">("list");
  const shown = useMemo(() => (items ? sortCollection(filterCollection(items, filters), sort, desc) : []), [items, filters, sort, desc]);
  const filtered = activeFilterCount(filters) > 0;
  const shownTotals = collectionTotals(shown);

  const prefs = useCurrency();
  const fmt = (usd: number) => formatMoney(usd, prefs);
  const totals = collectionTotals(items ?? []);
  const actionError = setQuantity.error ?? remove.error;

  return (
    <main className="page">
      <h1>{t("collection.title")}</h1>

      {!loadingMe && !me && (
        <section className="welcome">
          <h2>{t("collection.pitch.title")}</h2>
          <p>
            {t("collection.pitch.text")} <Link to="/login">{t("auth.signIn")}</Link>
            {t("collection.pitch.signIn")}
          </p>
          <div className="welcome-actions">
            <Link to="/login" search={{ mode: "register" }} className="button">
              {t("welcome.create")}
            </Link>
          </div>
        </section>
      )}
      {me && isLoading && <p className="hint">{t("common.loading")}</p>}
      {me && error && <p className="error">{error.message}</p>}
      {actionError && <p className="error">{actionError.message}</p>}

      {me && <ImportCollection />}

      {items && items.length > 0 && (
        <div className="row-actions">
          <button
            type="button"
            onClick={() =>
              // The byte-order mark makes Excel read accents and other characters as UTF-8.
              downloadText(`mtg-vault-collection-${new Date().toISOString().slice(0, 10)}.csv`, `\ufeff${collectionToCsv(items)}\r\n`, "text/csv")
            }
          >
            {t("collection.export")}
          </button>
          <Tip label={t("collection.export.tip.label")}>{t("collection.export.tip.text")}</Tip>
        </div>
      )}

      {items && (
        <>
          <div className="stats">
            <div className="stat">
              <b>{totals.copies}</b>
              <span>{t("collection.cards", { count: totals.copies })}</span>
            </div>
            <div className="stat">
              <b>{totals.stacks}</b>
              <span>
                {t("collection.stacks", { count: totals.stacks })}
                <Tip label={t("collection.stacks.tip.label")}>{t("collection.stacks.tip.text")}</Tip>
              </span>
            </div>
            <div className="stat">
              <b>{fmt(totals.valueUsd)}</b>
              <span>
                {t("collection.value")}
                <Tip label={t("collection.value.tip.label")}>{t("collection.value.tip.text")}</Tip>
              </span>
            </div>
          </div>
          <CurrencyControl />
          {totals.unpriced > 0 && <p className="hint">{t("collection.unpriced", { count: totals.unpriced })}</p>}
          {items.length === 0 && (
            <p className="hint">
              {t("collection.empty.before")}<Link to="/">{t("collection.empty.link")}</Link>
              {t("collection.empty.after")}
            </p>
          )}
          {items.length > 0 && (
            <CollectionFilterBar
              items={items}
              filters={filters}
              onFilters={setFilters}
              sort={sort}
              desc={desc}
              onSort={(next, descending) => {
                setSort(next);
                setDesc(descending);
              }}
            />
          )}
          {items.length > 0 && (
            <div className="chips" role="group" aria-label={t("collection.view")}>
              <span className="filter-title">{t("collection.view")}</span>
              {(["list", "art"] as const).map((v) => (
                <button key={v} type="button" className={view === v ? "chip on" : "chip"} aria-pressed={view === v} onClick={() => setView(v)}>
                  {t(`collection.view.${v}`)}
                </button>
              ))}
            </div>
          )}
          {filtered && items.length > 0 && (
            <p className="hint" role="status">
              {t("collection.showing", {
                shown: shown.length,
                total: items.length,
                cards: `${shownTotals.copies} ${t("collection.cards", { count: shownTotals.copies })}`,
                value: fmt(shownTotals.valueUsd),
              })}
            </p>
          )}
          {filtered && items.length > 0 && shown.length === 0 && <p className="hint">{t("collection.noMatches")}</p>}
          {view === "art" && (
            <ul className="art-gallery">
              {shown
                .filter((item) => item.image)
                .map((item) => (
                  <li key={item.id}>
                    <a href={artHref(item.printingId)} target="_blank" rel="noopener noreferrer" aria-label={t("collection.artLinkLabel", { name: item.name })}>
                      <img src={item.image!.artCrop} alt="" loading="lazy" />
                      <span className="art-caption">
                        <strong>{item.name}</strong>
                        <small>
                          {item.setName} · ×{item.quantity}
                        </small>
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
          )}
          <ul className="stacks" hidden={view === "art"}>
            {shown.map((item) => (
              <StackRow
                key={item.id}
                fmt={fmt}
                item={item}
                busy={remove.isPending}
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
  fmt: (usd: number) => string;
  item: CollectionItem;
  busy: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { item } = props;
  const { t } = useI18n();
  return (
    <li className="stack">
      <CardPreview name={item.name} image={item.image} className="thumb-wrap wide" />
      <div>
        <div className="name">{item.name}</div>
        <div className="sub">
          {item.setName} ({item.setCode.toUpperCase()}) #{item.collectorNumber} · {t(`finish.${item.finish}`)} · {item.condition}
          {item.language !== "en" ? ` · ${item.language}` : ""}
        </div>
        <div className="sub">
          {item.unitPrice != null
            ? t("collection.each", { price: props.fmt(item.unitPrice), total: props.fmt(item.unitPrice * item.quantity) })
            : t("price.none")}
        </div>
      </div>
      <div className="qty">
        <button type="button" aria-label={t("collection.less")} disabled={item.quantity <= 1} onClick={() => props.onQuantity(item.quantity - 1)}>
          −
        </button>
        <output aria-label={t("collection.quantity")}>{item.quantity}</output>
        <button type="button" aria-label={t("collection.more")} onClick={() => props.onQuantity(item.quantity + 1)}>
          +
        </button>
        <span className="spacer" />
        {item.image && (
          <a className="link" href={artHref(item.printingId)} target="_blank" rel="noopener noreferrer" aria-label={t("collection.artLinkLabel", { name: item.name })}>
            {t("collection.artLink")} ↗
          </a>
        )}
        <button type="button" className="link" disabled={props.busy} onClick={props.onRemove}>
          {t("common.remove")}
        </button>
      </div>
    </li>
  );
}
