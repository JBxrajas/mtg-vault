import { deckFormatSchema, deckTargetSize, type DeckFormat } from "@mtg-vault/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { fetchMe } from "./auth";
import { createDeck, fetchDecks } from "./decksApi";

export const formatLabel = (f: DeckFormat) => f.charAt(0).toUpperCase() + f.slice(1);

export function DecksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const { data: decks, isLoading, error } = useQuery({ queryKey: ["decks"], queryFn: fetchDecks, enabled: !!me });
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
      <h1>My decks</h1>
      {!loadingMe && !me && (
        <p className="hint">
          <Link to="/login">Sign in</Link> to build decks.
        </p>
      )}

      {me && (
        <form className="new-deck" onSubmit={submit}>
          <input
            aria-label="Deck name"
            placeholder="New deck name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)}>
            {deckFormatSchema.options.map((f) => (
              <option key={f} value={f}>
                {formatLabel(f)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={create.isPending || !name.trim()}>
            Create deck
          </button>
        </form>
      )}
      {create.error && <p className="error">{create.error.message}</p>}
      {isLoading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error.message}</p>}
      {decks && decks.length === 0 && <p className="hint">No decks yet. Name one above to start.</p>}

      <ul className="deck-list">
        {decks?.map((d) => {
          const target = deckTargetSize(d.format);
          return (
            <li key={d.id}>
              <Link to="/decks/$deckId" params={{ deckId: d.id }} className="deck-card">
                <span className="deck-name">{d.name}</span>
                <span className="badge">{formatLabel(d.format)}</span>
                <span className="deck-count">
                  {d.cardCount}
                  {target ? ` / ${target}` : ""} cards
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
