import { deckFormatSchema, deckTargetSize, type DeckFormat } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties, type FormEvent } from "react";
import { fetchMe } from "./auth";
import { createDeck, deleteDeck, fetchDecks } from "./decksApi";
import { useI18n } from "./i18n";
import { ImportDeck } from "./ImportDeck";
import { NewCommanderDeck } from "./NewCommanderDeck";
import { Tip } from "./Tip";

export const formatLabel = (f: DeckFormat) => f.charAt(0).toUpperCase() + f.slice(1);

export function DecksPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const { data: cached, isLoading, error } = useQuery({ queryKey: ["decks"], queryFn: fetchDecks, enabled: !!me });
  // Never show cached decks without a signed-in user (for example right after signing out).
  const decks = me ? cached : undefined;
  const [name, setName] = useState("");
  const [format, setFormat] = useState<DeckFormat>("casual");

  const create = useMutation({
    mutationFn: () => createDeck({ name, format }),
    onSuccess: async (deck) => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      await navigate({ to: "/decks/$deckId", params: { deckId: deck.id } });
    },
  });

  const remove = useMutation({
    mutationFn: deleteDeck,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["decks"] }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <main className="page">
      <h1>{t("decks.title")}</h1>
      {!loadingMe && !me && (
        <section className="welcome">
          <h2>{t("decks.pitch.title")}</h2>
          <p>
            {t("decks.pitch.text")} <Link to="/login">{t("auth.signIn")}</Link>
            {t("decks.pitch.signIn")}
          </p>
          <div className="welcome-actions">
            <Link to="/login" search={{ mode: "register" }} className="button">
              {t("welcome.create")}
            </Link>
          </div>
        </section>
      )}

      {me && (
        <form className="new-deck" onSubmit={submit}>
          <input
            aria-label={t("decks.name")}
            placeholder={t("decks.namePlaceholder")}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <select aria-label={t("decks.format")} value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)}>
            {deckFormatSchema.options.map((f) => (
              <option key={f} value={f}>
                {formatLabel(f)}
              </option>
            ))}
          </select>
          <Tip label={t("decks.format.tip.label")}>{t("decks.format.tip.text")}</Tip>
          <button type="submit" disabled={create.isPending || !name.trim()}>
            {t("decks.create")}
          </button>
        </form>
      )}
      {me && <NewCommanderDeck />}
      {me && <ImportDeck />}
      {(create.error ?? remove.error) && <p className="error">{(create.error ?? remove.error)!.message}</p>}
      {me && isLoading && <p className="hint">{t("common.loading")}</p>}
      {me && error && <p className="error">{error.message}</p>}
      {decks && decks.length === 0 && <p className="hint">{t("decks.empty")}</p>}

      <ul className="deck-list">
        {decks?.map((d) => {
          const target = deckTargetSize(d.format);
          const art = d.commander?.image?.artCrop;
          const share = target ? Math.min(1, d.cardCount / target) : 0;
          const state = target && d.cardCount > target ? "over" : target && d.cardCount === target ? "done" : "";
          return (
            <li key={d.id}>
              <Link to="/decks/$deckId" params={{ deckId: d.id }} className={art ? "deck-card has-art" : "deck-card"} style={art ? ({ "--deck-art": `url("${art}")` } as CSSProperties) : undefined}>
                <span className="deck-top">
                  <span className="badge">{formatLabel(d.format)}</span>
                  {d.commander && d.commander.colorIdentity.length > 0 && (
                    <span className="pips" aria-label={d.commander.colorIdentity.map((c) => t(`color.${c}`)).join(", ")}>
                      {d.commander.colorIdentity.map((c) => (
                        <span key={c} className={`pip pip-${c.toLowerCase()}`} aria-hidden="true">
                          {c}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="deck-name">{d.name}</span>
                {d.commander && <span className="deck-commander">{d.commander.name}</span>}
                {target && (
                  <span className={`deck-progress ${state}`} role="progressbar" aria-label={t("decks.progress")} aria-valuemin={0} aria-valuemax={target} aria-valuenow={d.cardCount}>
                    <i style={{ width: `${share * 100}%` }} />
                  </span>
                )}
                <span className="deck-count">{t("decks.cardCount", { count: d.cardCount, target: target ? ` / ${target}` : "" })}</span>
              </Link>
              <button
                type="button"
                className="deck-delete"
                disabled={remove.isPending}
                aria-label={t("decks.deleteLabel", { name: d.name })}
                onClick={() => {
                  if (window.confirm(t("deck.confirmDelete", { name: d.name }))) remove.mutate(d.id);
                }}
              >
                {t("decks.delete")}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
