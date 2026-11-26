import { auctionStatusSchema, type AuctionBid, type AuctionInput, type AuctionStatus, type DeckSummary } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";
import { searchCards } from "./api";
import { createAuction, updateAuction } from "./auctionsApi";
import { fromLocalInput, toLocalInput } from "./auctionTime";
import { useI18n } from "./i18n";
import { useDebouncedValue } from "./useDebouncedValue";

/** Text fields of the form; amounts and times are kept as typed and converted on save. */
interface Draft {
  cardName: string;
  oracleId: string | null;
  printingId: string | null;
  groupName: string;
  seller: string;
  postUrl: string;
  myBid: string;
  highBid: string;
  highBidder: string;
  maxBid: string;
  closesAt: string;
  status: AuctionStatus;
  pickupPlace: string;
  pickupAt: string;
  deckId: string;
  notes: string;
}

const text = (v: string | null | undefined) => v ?? "";
const amount = (v: number | null | undefined) => (v == null ? "" : String(v));

function draftOf(bid: AuctionBid | undefined, last: AuctionBid | undefined): Draft {
  return {
    cardName: text(bid?.cardName),
    oracleId: bid?.oracleId ?? null,
    printingId: bid?.printingId ?? null,
    // A new bid starts with the group and pick-up place of the last one: they repeat a lot.
    groupName: text(bid ? bid.groupName : last?.groupName),
    seller: text(bid?.seller),
    postUrl: text(bid?.postUrl),
    myBid: amount(bid?.myBid),
    highBid: amount(bid?.highBid),
    highBidder: text(bid?.highBidder),
    maxBid: amount(bid?.maxBid),
    closesAt: toLocalInput(bid?.closesAt ?? null),
    status: bid?.status ?? "winning",
    pickupPlace: text(bid ? bid.pickupPlace : last?.pickupPlace),
    pickupAt: toLocalInput(bid?.pickupAt ?? null),
    deckId: text(bid?.deckId),
    notes: text(bid?.notes),
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);
const numOrNull = (v: string) => {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function toAuctionInput(d: Draft): AuctionInput {
  return {
    cardName: d.cardName.trim(),
    oracleId: d.oracleId,
    printingId: d.printingId,
    groupName: orNull(d.groupName),
    seller: orNull(d.seller),
    postUrl: orNull(d.postUrl),
    myBid: numOrNull(d.myBid),
    highBid: numOrNull(d.highBid),
    highBidder: orNull(d.highBidder),
    maxBid: numOrNull(d.maxBid),
    closesAt: fromLocalInput(d.closesAt),
    status: d.status,
    pickupPlace: orNull(d.pickupPlace),
    pickupAt: fromLocalInput(d.pickupAt),
    deckId: d.deckId || null,
    notes: orNull(d.notes),
  };
}

/** Form to add a bid or change one. The card can be linked to the catalog by picking it from the suggestions. */
export function AuctionForm({
  bid,
  last,
  decks,
  onDone,
}: {
  bid?: AuctionBid;
  /** The most recent bid, to start a new one with its group and pick-up place. */
  last?: AuctionBid;
  decks: DeckSummary[];
  onDone: (saved?: AuctionBid) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(bid, last));
  const [suggest, setSuggest] = useState(false);
  const listId = useId();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const q = useDebouncedValue(draft.cardName.trim(), 300);
  const { data: results } = useQuery({
    queryKey: ["search", q, "auction"],
    queryFn: ({ signal }) => searchCards({ q, limit: 8 }, signal),
    enabled: suggest && q.length >= 2 && !draft.oracleId,
  });

  const save = useMutation({
    mutationFn: () => {
      const input = toAuctionInput(draft);
      return bid ? updateAuction(bid.id, input) : createAuction(input);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["auctions"] });
      onDone(saved);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.cardName.trim()) save.mutate();
  };

  const my = numOrNull(draft.myBid);
  const max = numOrNull(draft.maxBid);
  const overMax = my != null && max != null && my > max;

  const field = (key: keyof Draft, label: string, props: Record<string, unknown> = {}) => (
    <label className="field">
      {label}
      <input value={draft[key] as string} onChange={(e) => set(key, e.target.value as never)} {...props} />
    </label>
  );

  return (
    <form className="auction-form" onSubmit={submit} aria-label={bid ? t("auctions.form.editTitle") : t("auctions.form.newTitle")}>
      <h2>{bid ? t("auctions.form.editTitle") : t("auctions.form.newTitle")}</h2>
      <div className="auction-card-field">
        <label className="field">
          {t("auctions.form.card")}
          <input
            type="search"
            required
            maxLength={200}
            autoComplete="off"
            placeholder={t("auctions.form.cardPlaceholder")}
            aria-controls={listId}
            value={draft.cardName}
            onChange={(e) => {
              setSuggest(true);
              setDraft((d) => ({ ...d, cardName: e.target.value, oracleId: null, printingId: null }));
            }}
          />
        </label>
        <p className={draft.oracleId ? "ok" : "hint"}>{draft.oracleId ? `✓ ${t("auctions.form.linked")}` : t("auctions.form.unlinked")}</p>
        {suggest && !draft.oracleId && results && results.length > 0 && (
          <ul className="auction-suggest" id={listId}>
            {results.map((c) => (
              <li key={c.oracleId}>
                <button
                  type="button"
                  onClick={() => {
                    setSuggest(false);
                    setDraft((d) => ({ ...d, cardName: c.name, oracleId: c.oracleId, printingId: null }));
                  }}
                >
                  {c.image && <img src={c.image.small} alt="" loading="lazy" />}
                  <span>{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="auction-fields">
        {field("groupName", t("auctions.form.group"), { maxLength: 200 })}
        {field("seller", t("auctions.form.seller"), { maxLength: 200 })}
        {field("postUrl", t("auctions.form.postUrl"), { type: "url", maxLength: 500, placeholder: "https://" })}
        {field("myBid", t("auctions.form.myBid"), { type: "number", min: 0, step: "any", inputMode: "decimal" })}
        {field("highBid", t("auctions.form.highBid"), { type: "number", min: 0, step: "any", inputMode: "decimal" })}
        {field("highBidder", t("auctions.form.highBidder"), { maxLength: 200 })}
        {field("maxBid", t("auctions.form.maxBid"), { type: "number", min: 0, step: "any", inputMode: "decimal" })}
        {field("closesAt", t("auctions.form.closesAt"), { type: "datetime-local" })}
        <label className="field">
          {t("auctions.form.status")}
          <select value={draft.status} onChange={(e) => set("status", e.target.value as AuctionStatus)}>
            {auctionStatusSchema.options.map((s) => (
              <option key={s} value={s}>
                {t(`auctions.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {field("pickupPlace", t("auctions.form.pickupPlace"), { maxLength: 200 })}
        {field("pickupAt", t("auctions.form.pickupAt"), { type: "datetime-local" })}
        <label className="field">
          {t("auctions.form.deck")}
          <select value={draft.deckId} onChange={(e) => set("deckId", e.target.value)}>
            <option value="">{t("auctions.form.noDeck")}</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        {t("auctions.form.notes")}
        <textarea rows={2} maxLength={1000} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      {overMax && <p className="error">{t("auctions.form.overMax")}</p>}
      {save.error && <p className="error">{save.error.message}</p>}
      <div className="auction-form-actions">
        <button type="submit" disabled={save.isPending || !draft.cardName.trim()}>
          {save.isPending ? t("auctions.form.saving") : t("auctions.form.save")}
        </button>
        <button type="button" onClick={() => onDone()}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
