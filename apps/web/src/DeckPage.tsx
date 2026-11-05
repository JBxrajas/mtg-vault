import {
  cardProblems,
  colorWords,
  deckBoards,
  deckCount,
  deckFormatSchema,
  deckTargetSize,
  groupByCategory,
  problemKey,
  type CardProblem,
  type Color,
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
import { CardPreview } from "./CardPreview";
import { CommanderBar } from "./CommanderBar";
import { DeckAnalysis } from "./DeckAnalysis";
import { DeckHero } from "./DeckHero";
import { FoldOnPhone } from "./FoldOnPhone";
import { DeckListTools } from "./DeckListTools";
import { formatLabel } from "./DecksPage";
import { useI18n } from "./i18n";
import { ManaCost } from "./ManaCost";
import { Tip } from "./Tip";
import { useDebouncedValue } from "./useDebouncedValue";

const BOARD_KEY = {
  main: "board.main",
  commander: "board.commander",
  sideboard: "board.sideboard",
  maybeboard: "board.maybeboard",
} as const;

/** "Owned" badge: whether the collection covers the copies the deck needs. */
export function ownedBadge(card: Pick<DeckCardEntry, "owned" | "quantity">, t: ReturnType<typeof useI18n>["t"]) {
  if (card.owned >= card.quantity) return { text: t("deck.owned"), enough: true };
  return { text: t("deck.own", { owned: card.owned, needed: card.quantity }), enough: false };
}

export function DeckPage() {
  const { t } = useI18n();
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
  const chooseCommander = useMutation({
    mutationFn: (v: { oracleId: string; printingId: string | null }) =>
      addDeckCard(deckId, { oracleId: v.oracleId, board: "commander", quantity: 1, ...(v.printingId ? { printingId: v.printingId } : {}) }),
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
          <Link to="/login">{t("auth.signIn")}</Link>
          {t("deck.signInTo")}
        </p>
      </main>
    );
  }
  if (isLoading || !data) {
    return (
      <main className="page">
        {error ? <p className="error">{error.message}</p> : <p className="hint">{t("common.loading")}</p>}
        <p>
          <Link to="/decks">{t("deck.backLong")}</Link>
        </p>
      </main>
    );
  }

  const { deck, cards } = data;
  const target = deckTargetSize(deck.format);
  const count = deckCount(cards);
  const mutationError = setCard.error ?? addCard.error ?? chooseCommander.error;
  const busy = setCard.isPending || addCard.isPending || chooseCommander.isPending;
  const isCommander = deck.format === "commander";
  const needsCommander = isCommander && !cards.some((c) => c.board === "commander");
  const problems = isCommander ? cardProblems(cards) : new Map<string, CardProblem[]>();
  const flat = (board: DeckBoard) => cards.filter((c) => c.board === board);

  return (
    <main className="page wide">
      <DeckHero deck={deck} cards={cards} count={count} issues={problems.size} />
      {mutationError && <p className="error">{mutationError.message}</p>}

      {isCommander && (
        <CommanderBar
          cards={cards}
          busy={busy}
          onChoose={(choice) => chooseCommander.mutate({ oracleId: choice.card.oracleId, printingId: choice.printingId })}
        />
      )}

      <div className="deck-tools">
        <DeckSettings deckId={deckId} deck={deck} onDelete={() => remove.mutate()} deleting={remove.isPending} />
        <DeckListTools deckId={deckId} deckName={deck.name} cards={cards} needsCommander={needsCommander} />
      </div>

      <div className="deck-layout">
      {deck.format === "commander" && (
        <aside className="deck-side">
          <FoldOnPhone title={t("deck.analysis")}>
            <DeckAnalysis cards={cards} />
          </FoldOnPhone>
        </aside>
      )}
      <div className="deck-main">
      <AddCards
        formats={deckBoards(deck.format)}
        busy={busy}
        onAdd={(oracleId, board) => addCard.mutate({ oracleId, board })}
      />

      {/* The help bubble sits beside the tabs, not inside them: the tabs scroll sideways on a phone, and a scrolling box clips (and scrolls) anything that hangs out of it. */}
      <div className="tabs-row">
        <div className="tabs" role="group" aria-label={t("deck.boards")}>
          {(["main", "sideboard", "maybeboard"] as const).map((b) => (
            <button key={b} type="button" aria-pressed={tab === b} className={tab === b ? "tab on" : "tab"} onClick={() => setTab(b)}>
              {t(BOARD_KEY[b])} ({b === "main" ? count : flat(b).reduce((n, c) => n + c.quantity, 0)})
            </button>
          ))}
        </div>
        <Tip label={t("deck.boards.tip.label")}>{t("deck.boards.tip.text")}</Tip>
      </div>

      {tab === "main" ? (
        <MainBoard cards={cards} busy={busy} problems={problems} onSet={(c, quantity) => setCard.mutate({ oracleId: c.oracleId, board: c.board, quantity })} />
      ) : (
        <ul className="deck-rows">
          {flat(tab).map((c) => (
            <DeckRow key={`${c.oracleId}-${c.board}`} card={c} busy={busy} onSet={(quantity) => setCard.mutate({ oracleId: c.oracleId, board: c.board, quantity })} />
          ))}
          {flat(tab).length === 0 && <p className="hint">{t("deck.nothing", { board: t(BOARD_KEY[tab]).toLowerCase() })}</p>}
        </ul>
      )}
      </div>
      </div>
    </main>
  );
}

function MainBoard(props: {
  cards: DeckCardEntry[];
  busy: boolean;
  problems: Map<string, CardProblem[]>;
  onSet: (card: DeckCardEntry, quantity: number) => void;
}) {
  const { t } = useI18n();
  const groups = groupByCategory(props.cards);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  if (groups.length === 0) return <p className="hint">{t("deck.empty")}</p>;
  const toggle = (category: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(category)) next.add(category);
      return next;
    });
  const allCollapsed = groups.every((g) => collapsed.has(g.category));
  return (
    <div>
      {groups.length > 1 && (
        <button type="button" className="link" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.category)))}>
          {allCollapsed ? t("deck.expandAll") : t("deck.collapseAll")}
        </button>
      )}
      {groups.map((g) => {
        const open = !collapsed.has(g.category);
        const bad = g.items.filter((c) => props.problems.has(problemKey(c))).length;
        return (
          <section key={g.category} aria-label={t(`category.${g.category}`)}>
            <h2 className="group-title">
              <button type="button" className={open ? "group-toggle open" : "group-toggle"} aria-expanded={open} onClick={() => toggle(g.category)}>
                {t(`category.${g.category}`)} <span className="count">({g.count})</span>
              </button>
              {bad > 0 && !open && <span className="problem-count">{t("deck.problemsIn", { count: bad })}</span>}
            </h2>
            <ul className="deck-rows" hidden={!open}>
              {g.items.map((c) => (
                <DeckRow key={`${c.oracleId}-${c.board}`} card={c} busy={props.busy} problems={props.problems.get(problemKey(c))} onSet={(quantity) => props.onSet(c, quantity)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Problem parameters for the text: color letters become words ("R" → "Red"). */
const readable = (p: CardProblem) =>
  typeof p.params.colors === "string" ? { ...p.params, colors: colorWords(p.params.colors.split(" ") as Color[]).join(", ") } : p.params;

function DeckRow(props: { card: DeckCardEntry; busy: boolean; problems?: CardProblem[] | undefined; onSet: (quantity: number) => void }) {
  const { card } = props;
  const { t } = useI18n();
  const owned = ownedBadge(card, t);
  return (
    <li className={props.problems?.length ? "deck-row has-problem" : "deck-row"}>
      <CardPreview name={card.name} image={card.image} />
      <div className="deck-row-info">
        <div className="name">{card.name}</div>
        <ManaCost cost={card.manaCost} />
        <span className={owned.enough ? "owned yes" : "owned no"}>{owned.text}</span>
        {props.problems?.map((p) => (
          <span key={p.code} className="problem" role="note">
            ⚠ {t(`problem.${p.code}`, readable(p))}
          </span>
        ))}
      </div>
      <div className="qty">
        <button type="button" aria-label={t("deck.less", { name: card.name })} disabled={props.busy} onClick={() => props.onSet(card.quantity - 1)}>
          −
        </button>
        <output aria-label={t("deck.quantity", { name: card.name })}>{card.quantity}</output>
        <button type="button" aria-label={t("deck.more", { name: card.name })} disabled={props.busy} onClick={() => props.onSet(card.quantity + 1)}>
          +
        </button>
        <button type="button" className="link" disabled={props.busy} aria-label={t("deck.remove", { name: card.name })} onClick={() => props.onSet(0)}>
          {t("common.remove")}
        </button>
      </div>
    </li>
  );
}

function AddCards(props: { formats: DeckBoard[]; busy: boolean; onAdd: (oracleId: string, board: DeckBoard) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [board, setBoard] = useState<DeckBoard>("main");
  const q = useDebouncedValue(text.trim(), 300);
  const { data, isFetching } = useQuery({
    queryKey: ["cards", "search", "deck", q],
    queryFn: ({ signal }) => searchCards({ q, limit: 8 }, signal),
    enabled: q.length >= 2,
  });
  return (
    <section className="add-cards" aria-label={t("deck.addCards")}>
      <div className="add-cards-bar">
        <input
          type="search"
          aria-label={t("deck.searchToAdd")}
          placeholder={t("deck.addPlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select aria-label={t("deck.addToBoard")} value={board} onChange={(e) => setBoard(e.target.value as DeckBoard)}>
          {props.formats.map((b) => (
            <option key={b} value={b}>
              {t(BOARD_KEY[b])}
            </option>
          ))}
        </select>
      </div>
      {q.length >= 2 && isFetching && <p className="hint">{t("search.searching")}</p>}
      <ul className="deck-rows">
        {q.length >= 2 &&
          data?.map((c) => (
            <li key={c.oracleId} className="deck-row">
              <CardPreview name={c.name} image={c.image} />
              <div className="deck-row-info">
                <div className="name">{c.name}</div>
                <ManaCost cost={c.manaCost} />
                <span className="sub">{c.typeLine}</span>
              </div>
              <button type="button" disabled={props.busy} aria-label={t("deck.add", { name: c.name })} onClick={() => props.onAdd(c.oracleId, board)}>
                {t("add.add")}
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
  const { t } = useI18n();
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
      <summary>{t("deck.settings")}</summary>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <label>
          {t("deck.name")}
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t("deck.format")}
          <select value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)}>
            {deckFormatSchema.options.map((f) => (
              <option key={f} value={f}>
                {formatLabel(f)}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> {t("deck.publicDeck")}
        </label>
        <div className="settings-actions">
          <button type="submit" disabled={save.isPending || !name.trim()}>
            {t("common.save")}
          </button>
          <button
            type="button"
            className="danger"
            disabled={props.deleting}
            onClick={() => {
              if (window.confirm(t("deck.confirmDelete", { name: deck.name }))) props.onDelete();
            }}
          >
            {t("deck.delete")}
          </button>
        </div>
        {save.isSuccess && <p className="ok">{t("deck.saved")}</p>}
        {save.error && <p className="error">{save.error.message}</p>}
      </form>
    </details>
  );
}
