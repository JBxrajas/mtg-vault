import { deckFormatSchema, deckTargetSize, type DeckFormat } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { fetchMe } from "./auth";
import { createDeck, fetchDecks } from "./decksApi";
import { useI18n } from "./i18n";
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
      {create.error && <p className="error">{create.error.message}</p>}
      {me && isLoading && <p className="hint">{t("common.loading")}</p>}
      {me && error && <p className="error">{error.message}</p>}
      {decks && decks.length === 0 && <p className="hint">{t("decks.empty")}</p>}

      <ul className="deck-list">
        {decks?.map((d) => {
          const target = deckTargetSize(d.format);
          return (
            <li key={d.id}>
              <Link to="/decks/$deckId" params={{ deckId: d.id }} className="deck-card">
                <span className="deck-name">{d.name}</span>
                <span className="badge">{formatLabel(d.format)}</span>
                <span className="deck-count">{t("decks.cardCount", { count: d.cardCount, target: target ? ` / ${target}` : "" })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
