import {
  deckBoards,
  deckCount,
  deckFormatSchema,
  deckTargetSize,
  groupByCategory,
  type DeckBoard,
  type DeckCardEntry,
  type DeckDetail,
  type DeckFormat,
} from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { searchCards } from "./api";
import { fetchMe } from "./auth";
import { addDeckCard, deleteDeck, fetchDeck, setDeckCard, updateDeck } from "./decksApi";
import { formatLabel } from "./DecksPage";
import { ManaCost } from "./ManaCost";
import { useDebouncedValue } from "./useDebouncedValue";

const BOARD_LABEL: Record<DeckBoard, string> = {
  main: "Main",
  commander: "Commander",
  sideboard: "Sideboard",
  maybeboard: "Maybeboard",
};

/** "Owned" badge: whether the collection covers the copies the deck needs. */
export function ownedBadge(card: Pick<DeckCardEntry, "owned" | "quantity">) {
  if (card.owned >= card.quantity) return { text: "Owned", enough: true };
  return { text: `Own ${card.owned}/${card.quantity}`, enough: false };
}

export function DeckPage() {
  const { deckId } = useParams({ strict: false }) as { deckId: string };
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const { data, isLoading, error } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => fetchDeck(deckId),
    enabled: !!me,
  });
  const [tab, setTab] = useState<"main" | "sideboard" | "maybeboard">("main");

  const store = (detail: DeckDetail) => {
    queryClient.setQueryData(["deck", deckId], detail);
    void queryClient.invalidateQueries({ queryKey: ["decks"] });
  };
  const setCard = useMutation({
    mutationFn: (v: { oracleId: string; board: DeckBoard; quantity: number }) => setDeckCard(deckId, v),
    onSuccess: store,
  });
  const addCard = useMutation({
    mutationFn: (v: { oracleId: string; board: DeckBoard }) => addDeckCard(deckId, { ...v, quantity: 1 }),
    onSuccess: store,
  });
  const remove = useMutation({
    mutationFn: () => deleteDeck(deckId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      await navigate({ to: "/decks" });
    },
  });

  if (!loadingMe && !me) {
    return (
      <main className="page">
        <p className="hint">
          <Link to="/login">Sign in</Link> to see this deck.
        </p>
      </main>
    );
  }
  if (isLoading || !data) {
    return (
      <main className="page">
        {error ? <p className="error">{error.message}</p> : <p className="hint">Loading…</p>}
        <p>
          <Link to="/decks">Back to my decks</Link>
        </p>
      </main>
    );
  }

  const { deck, cards } = data;
  const target = deckTargetSize(deck.format);
  const count = deckCount(cards);
  const mutationError = setCard.error ?? addCard.error;
  const busy = setCard.isPending || addCard.isPending;
  const flat = (board: DeckBoard) => cards.filter((c) => c.board === board);

  return (
    <main className="page">
      <p>
        <Link to="/decks">← My decks</Link>
      </p>
      <h1>{deck.name}</h1>
      <p className="deck-meta">
        <span className="badge">{formatLabel(deck.format)}</span>
        <span className={target && count > target ? "count over" : "count"}>
          {count}
          {target ? ` / ${target}` : ""} cards
        </span>
        {deck.isPublic && <span className="badge">Public</span>}
      </p>
      {deck.description && <p className="subtitle">{deck.description}</p>}
      {mutationError && <p className="error">{mutationError.message}</p>}

      <DeckSettings deckId={deckId} deck={deck} onDelete={() => remove.mutate()} deleting={remove.isPending} />

      <AddCards
        formats={deckBoards(deck.format)}
        busy={busy}
        onAdd={(oracleId, board) => addCard.mutate({ oracleId, board })}
      />

      <div className="tabs" role="group" aria-label="Boards">
        {(["main", "sideboard", "maybeboard"] as const).map((b) => (
          <button key={b} type="button" aria-pressed={tab === b} className={tab === b ? "tab on" : "tab"} onClick={() => setTab(b)}>
            {BOARD_LABEL[b]} ({b === "main" ? count : flat(b).reduce((n, c) => n + c.quantity, 0)})
          </button>
        ))}
      </div>

      {tab === "main" ? (
        <MainBoard cards={cards} busy={busy} onSet={(c, quantity) => setCard.mutate({ oracleId: c.oracleId, board: c.board, quantity })} />
      ) : (
        <ul className="deck-rows">
          {flat(tab).map((c) => (
            <DeckRow key={`${c.oracleId}-${c.board}`} card={c} busy={busy} onSet={(quantity) => setCard.mutate({ oracleId: c.oracleId, board: c.board, quantity })} />
          ))}
          {flat(tab).length === 0 && <p className="hint">Nothing in the {BOARD_LABEL[tab].toLowerCase()} yet.</p>}
        </ul>
      )}
    </main>
  );
}

function MainBoard(props: { cards: DeckCardEntry[]; busy: boolean; onSet: (card: DeckCardEntry, quantity: number) => void }) {
  const groups = groupByCategory(props.cards);
  if (groups.length === 0) return <p className="hint">This deck is empty. Search a card above to add it.</p>;
  return (
    <div>
      {groups.map((g) => (
        <section key={g.category} aria-label={g.category}>
          <h2 className="group-title">
            {g.category} <span className="count">({g.count})</span>
          </h2>
          <ul className="deck-rows">
            {g.items.map((c) => (
              <DeckRow key={`${c.oracleId}-${c.board}`} card={c} busy={props.busy} onSet={(quantity) => props.onSet(c, quantity)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DeckRow(props: { card: DeckCardEntry; busy: boolean; onSet: (quantity: number) => void }) {
  const { card } = props;
  const owned = ownedBadge(card);
  return (
    <li className="deck-row">
      {card.image ? <img src={card.image.small} alt="" loading="lazy" /> : <div className="thumb-ph" aria-hidden="true" />}
      <div className="deck-row-info">
        <div className="name">{card.name}</div>
        <ManaCost cost={card.manaCost} />
        <span className={owned.enough ? "owned yes" : "owned no"}>{owned.text}</span>
      </div>
      <div className="qty">
        <button type="button" aria-label={`One less ${card.name}`} disabled={props.busy} onClick={() => props.onSet(card.quantity - 1)}>
          −
        </button>
        <output aria-label={`${card.name} quantity`}>{card.quantity}</output>
        <button type="button" aria-label={`One more ${card.name}`} disabled={props.busy} onClick={() => props.onSet(card.quantity + 1)}>
          +
        </button>
        <button type="button" className="link" disabled={props.busy} aria-label={`Remove ${card.name}`} onClick={() => props.onSet(0)}>
          Remove
        </button>
      </div>
    </li>
  );
}

function AddCards(props: { formats: DeckBoard[]; busy: boolean; onAdd: (oracleId: string, board: DeckBoard) => void }) {
  const [text, setText] = useState("");
  const [board, setBoard] = useState<DeckBoard>("main");
  const q = useDebouncedValue(text.trim(), 300);
  const { data, isFetching } = useQuery({
    queryKey: ["cards", "search", "deck", q],
    queryFn: ({ signal }) => searchCards({ q, limit: 8 }, signal),
    enabled: q.length >= 2,
  });
  return (
    <section className="add-cards" aria-label="Add cards">
      <div className="add-cards-bar">
        <input
          type="search"
          aria-label="Search a card to add"
          placeholder="Add a card…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select aria-label="Add to board" value={board} onChange={(e) => setBoard(e.target.value as DeckBoard)}>
          {props.formats.map((b) => (
            <option key={b} value={b}>
              {BOARD_LABEL[b]}
            </option>
          ))}
        </select>
      </div>
      {q.length >= 2 && isFetching && <p className="hint">Searching…</p>}
      <ul className="deck-rows">
        {q.length >= 2 &&
          data?.map((c) => (
            <li key={c.oracleId} className="deck-row">
              {c.image ? <img src={c.image.small} alt="" loading="lazy" /> : <div className="thumb-ph" aria-hidden="true" />}
              <div className="deck-row-info">
                <div className="name">{c.name}</div>
                <ManaCost cost={c.manaCost} />
                <span className="sub">{c.typeLine}</span>
              </div>
              <button type="button" disabled={props.busy} aria-label={`Add ${c.name}`} onClick={() => props.onAdd(c.oracleId, board)}>
                Add
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}

function DeckSettings(props: {
  deckId: string;
  deck: DeckDetail["deck"];
  onDelete: () => void;
  deleting: boolean;
}) {
  const queryClient = useQueryClient();
  const { deck } = props;
  const [name, setName] = useState(deck.name);
  const [format, setFormat] = useState<DeckFormat>(deck.format);
  const [isPublic, setIsPublic] = useState(deck.isPublic);
  const save = useMutation({
    mutationFn: () => updateDeck(props.deckId, { name, format, isPublic }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deck", props.deckId] });
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });
  return (
    <details className="settings">
      <summary>Deck settings</summary>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <label>
          Name
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)}>
            {deckFormatSchema.options.map((f) => (
              <option key={f} value={f}>
                {formatLabel(f)}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public deck
        </label>
        <div className="settings-actions">
          <button type="submit" disabled={save.isPending || !name.trim()}>
            Save
          </button>
          <button
            type="button"
            className="danger"
            disabled={props.deleting}
            onClick={() => {
              if (window.confirm(`Delete "${deck.name}"? This cannot be undone.`)) props.onDelete();
            }}
          >
            Delete deck
          </button>
        </div>
        {save.isSuccess && <p className="ok">Saved.</p>}
        {save.error && <p className="error">{save.error.message}</p>}
      </form>
    </details>
  );
}
