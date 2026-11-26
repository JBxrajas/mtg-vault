import {
  auctionAlerts,
  auctionPrice,
  auctionStatusSchema,
  auctionTotals,
  isOpenAuction,
  sortAuctions,
  type AuctionAlert,
  type AuctionBid,
  type AuctionStatus,
  type Finish,
} from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchPrintings } from "./api";
import { fetchMe } from "./auth";
import { AuctionForm } from "./AuctionForm";
import { deleteAuction, fetchAuctions, updateAuction } from "./auctionsApi";
import { countdown, shortDateTime } from "./auctionTime";
import { addToCollection } from "./collectionApi";
import { useCurrency } from "./currency";
import { fetchDecks } from "./decksApi";
import { money, printingLabel } from "./format";
import { useI18n } from "./i18n";

const mxn = (v: number | null) => (v == null ? "—" : money("MXN", v));

/** The current time, ticking every second while the page is open. */
function useNow(stepMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}

const ROW_CLASS: Partial<Record<AuctionAlert, string>> = { losing: "is-losing", closingSoon: "is-soon", closed: "is-closed" };

/** Auction bids: totals, a table by closing time with a countdown, and quick status changes. */
export function AuctionsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const now = useNow();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const { data: cached, isLoading, error } = useQuery({ queryKey: ["auctions"], queryFn: fetchAuctions, enabled: !!me });
  const { data: decks } = useQuery({ queryKey: ["decks"], queryFn: fetchDecks, enabled: !!me });
  const bids = me ? cached : undefined;
  // "new" for the add form, a bid for the edit form.
  const [editing, setEditing] = useState<AuctionBid | "new" | null>(null);
  // A bid just marked as picked up: offer to add it to the collection.
  const [collecting, setCollecting] = useState<AuctionBid | null>(null);

  const sorted = useMemo(() => sortAuctions(bids ?? []), [bids]);
  const totals = useMemo(() => auctionTotals(bids ?? []), [bids]);
  const last = useMemo(() => [...(bids ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [bids]);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AuctionStatus }) => updateAuction(id, { status }),
    onSuccess: async (bid) => {
      await queryClient.invalidateQueries({ queryKey: ["auctions"] });
      if (bid.status === "picked_up") setCollecting(bid);
    },
  });

  const remove = useMutation({
    mutationFn: deleteAuction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auctions"] }),
  });

  const saved = (bid?: AuctionBid) => {
    const before = editing !== "new" ? editing : null;
    setEditing(null);
    if (bid?.status === "picked_up" && before?.status !== "picked_up") setCollecting(bid);
  };

  return (
    <main className="page wide auctions-page">
      <h1>{t("auctions.title")}</h1>
      {!loadingMe && !me && (
        <section className="welcome">
          <h2>{t("auctions.pitch.title")}</h2>
          <p>
            {t("auctions.pitch.text")} <Link to="/login">{t("auth.signIn")}</Link>
            {t("auctions.pitch.signIn")}
          </p>
          <div className="welcome-actions">
            <Link to="/login" search={{ mode: "register" }} className="button">
              {t("welcome.create")}
            </Link>
          </div>
        </section>
      )}

      {me && (
        <>
          <p className="hint">{t("auctions.intro")}</p>
          <div className="stats auction-stats">
            <div className="stat">
              <b>{mxn(totals.committed)}</b>
              <span>{t("auctions.totals.committed")}</span>
            </div>
            <div className="stat">
              <b>{mxn(totals.toPay.amount)}</b>
              <span>{t("auctions.totals.toPay", { count: totals.toPay.count })}</span>
            </div>
            <div className="stat">
              <b>{mxn(totals.toPickUp.amount)}</b>
              <span>{t("auctions.totals.toPickUp", { count: totals.toPickUp.count })}</span>
            </div>
            <div className="stat">
              <b>
                {totals.winning} · {totals.losing}
              </b>
              <span>{t("auctions.totals.open")}</span>
            </div>
          </div>
          {editing === null && (
            <button type="button" className="btn-primary" onClick={() => setEditing("new")}>
              {t("auctions.add")}
            </button>
          )}
          {editing !== null && (
            <AuctionForm
              key={editing === "new" ? "new" : editing.id}
              bid={editing === "new" ? undefined : editing}
              last={last}
              decks={decks ?? []}
              onDone={saved}
            />
          )}
          {collecting && <CollectWonCard bid={collecting} onClose={() => setCollecting(null)} />}
        </>
      )}

      {(setStatus.error ?? remove.error) && <p className="error">{(setStatus.error ?? remove.error)!.message}</p>}
      {me && isLoading && <p className="hint">{t("common.loading")}</p>}
      {me && error && <p className="error">{error.message}</p>}
      {bids && bids.length === 0 && <p className="hint">{t("auctions.empty")}</p>}

      {sorted.length > 0 && (
        <table className="auction-table">
          <thead>
            <tr>
              <th scope="col">{t("auctions.col.card")}</th>
              <th scope="col">{t("auctions.col.closes")}</th>
              <th scope="col">{t("auctions.col.myBid")}</th>
              <th scope="col">{t("auctions.col.highBid")}</th>
              <th scope="col">{t("auctions.col.max")}</th>
              <th scope="col">{t("auctions.col.status")}</th>
              <th scope="col">{t("auctions.col.pickup")}</th>
              <th scope="col">
                <span className="sr-only">{t("auctions.col.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const alerts = auctionAlerts(b, now);
              const rowClass = alerts.map((a) => ROW_CLASS[a]).filter(Boolean).join(" ");
              const left = countdown(b.closesAt, now);
              const open = isOpenAuction(b.status);
              return (
                <tr key={b.id} className={`${rowClass} status-${b.status}`.trim()}>
                  <td className="auction-card" data-label={t("auctions.col.card")}>
                    <div className="auction-card-body">
                      {b.image ? <img src={b.image.small} alt="" loading="lazy" /> : <span className="auction-noimg" aria-hidden="true" />}
                      <div>
                        <strong>{b.cardName}</strong>
                        {alerts.length > 0 && (
                          <span className="auction-alerts">
                            {alerts.map((a) => (
                              <span key={a} className={`badge alert-${a}`}>
                                {t(`auctions.alert.${a}`)}
                              </span>
                            ))}
                          </span>
                        )}
                        <small>
                          {[b.groupName, b.seller && t("auctions.by", { who: b.seller })].filter(Boolean).join(" · ")}
                          {b.postUrl && (
                            <>
                              {(b.groupName || b.seller) && " · "}
                              <a href={b.postUrl} target="_blank" rel="noopener noreferrer">
                                {t("auctions.post")}
                              </a>
                            </>
                          )}
                        </small>
                        {b.deckName && <small className="auction-deck">{t("auctions.forDeck", { deck: b.deckName })}</small>}
                      </div>
                    </div>
                  </td>
                  <td data-label={t("auctions.col.closes")}>
                    {b.closesAt ? (
                      <>
                        {open && left ? <span className="countdown" role="timer">{left}</span> : <span className="muted">{t("auctions.closed")}</span>}
                        <small>{shortDateTime(b.closesAt)}</small>
                      </>
                    ) : (
                      <span className="muted">{t("auctions.noTime")}</span>
                    )}
                  </td>
                  <td data-label={t("auctions.col.myBid")}>{mxn(b.myBid)}</td>
                  <td data-label={t("auctions.col.highBid")}>
                    {mxn(b.highBid)}
                    {b.highBidder && <small>{b.highBidder}</small>}
                  </td>
                  <td data-label={t("auctions.col.max")}>{mxn(b.maxBid)}</td>
                  <td data-label={t("auctions.col.status")}>
                    <select
                      aria-label={t("auctions.statusLabel", { name: b.cardName })}
                      value={b.status}
                      disabled={setStatus.isPending}
                      onChange={(e) => setStatus.mutate({ id: b.id, status: e.target.value as AuctionStatus })}
                    >
                      {auctionStatusSchema.options.map((s) => (
                        <option key={s} value={s}>
                          {t(`auctions.status.${s}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label={t("auctions.col.pickup")}>
                    {b.pickupPlace ?? (b.pickupAt ? "" : "—")}
                    {b.pickupAt && <small>{shortDateTime(b.pickupAt)}</small>}
                  </td>
                  <td className="auction-actions">
                    <button type="button" aria-label={t("auctions.editLabel", { name: b.cardName })} onClick={() => setEditing(b)}>
                      {t("auctions.edit")}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={remove.isPending}
                      aria-label={t("auctions.deleteLabel", { name: b.cardName })}
                      onClick={() => {
                        if (window.confirm(t("auctions.confirmDelete", { name: b.cardName }))) remove.mutate(b.id);
                      }}
                    >
                      {t("auctions.delete")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

const FINISH_KEY = { nonfoil: "finish.nonfoil", foil: "finish.foil", etched: "finish.etched" } as const;

/**
 * Offered after a bid is marked as picked up: adds one copy to the collection, with the price paid
 * converted to dollars (the collection keeps prices in USD) at the user's own rate.
 */
export function CollectWonCard({ bid, onClose }: { bid: AuctionBid; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { rate } = useCurrency();
  const { data: printings } = useQuery({
    queryKey: ["printings", bid.oracleId],
    queryFn: ({ signal }) => fetchPrintings(bid.oracleId!, signal),
    enabled: !!bid.oracleId,
  });
  const [printingId, setPrintingId] = useState<string | null>(bid.printingId);
  const [finish, setFinish] = useState<Finish | null>(null);
  const printing = printings?.find((p) => p.id === printingId) ?? printings?.[0];
  const finishes = (printing?.finishes.length ? printing.finishes : ["nonfoil"]) as Finish[];
  const effectiveFinish = finish && finishes.includes(finish) ? finish : finishes[0]!;
  const paid = auctionPrice(bid);
  const usd = Math.round((paid / rate) * 100) / 100;

  const add = useMutation({
    mutationFn: () =>
      addToCollection({
        printingId: printing!.id,
        quantity: 1,
        finish: effectiveFinish,
        ...(paid > 0 ? { purchasePrice: usd } : {}),
        acquiredOn: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collection"] }),
  });

  return (
    <section className="auction-collect" aria-label={t("auctions.collect.title", { name: bid.cardName })}>
      <strong>{t("auctions.collect.title", { name: bid.cardName })}</strong>
      {!bid.oracleId ? (
        <p className="hint">{t("auctions.collect.unlinked")}</p>
      ) : add.isSuccess ? (
        <p className="ok">
          {t("auctions.collect.added")} <Link to="/collection">{t("add.myCollection")}</Link>
        </p>
      ) : (
        <>
          <div className="add-fields">
            <label>
              {t("auctions.collect.printing")}
              <select value={printing?.id ?? ""} onChange={(e) => setPrintingId(e.target.value)} disabled={!printings}>
                {printings?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {printingLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("auctions.collect.finish")}
              <select value={effectiveFinish} onChange={(e) => setFinish(e.target.value as Finish)}>
                {finishes.map((f) => (
                  <option key={f} value={f}>
                    {t(FINISH_KEY[f])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {paid > 0 && <p className="hint">{t("auctions.collect.price", { mxn: mxn(paid), usd: money("USD", usd), rate })}</p>}
          {add.error && <p className="error">{add.error.message}</p>}
        </>
      )}
      <div className="auction-form-actions">
        {bid.oracleId && !add.isSuccess && (
          <button type="button" className="btn-primary" disabled={!printing || add.isPending} onClick={() => add.mutate()}>
            {t("auctions.collect.add")}
          </button>
        )}
        <button type="button" onClick={onClose}>
          {add.isSuccess ? t("auctions.collect.done") : t("auctions.collect.notNow")}
        </button>
      </div>
    </section>
  );
}
