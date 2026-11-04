import { colorSchema, type CardSearchResult, type Color } from "@mtg-vault/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchCards } from "./api";
import { AuthBar } from "./AuthBar";
import { CardDetail } from "./CardDetail";
import { useDebouncedValue } from "./useDebouncedValue";

const COLORS = colorSchema.options;
const COLOR_NAMES: Record<Color, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

export function SearchPage() {
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const [colors, setColors] = useState<Color[]>([]);
  const [preview, setPreview] = useState<CardSearchResult | null>(null);
  const q = useDebouncedValue(text.trim(), 300);
  const typeFilter = useDebouncedValue(type.trim(), 300);

  const enabled = q.length >= 2;
  const { data, isFetching, error } = useQuery({
    queryKey: ["cards", "search", q, typeFilter, colors],
    queryFn: ({ signal }) =>
      searchCards({ q, type: typeFilter || undefined, colors, limit: 30 }, signal),
    enabled,
    placeholderData: (previous) => previous,
  });

  const toggle = (c: Color) =>
    setColors((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <main className="page">
      <AuthBar />
      <h1>mtg-vault</h1>
      <p className="subtitle">Search cards by name.</p>

      <input
        className="search"
        type="search"
        placeholder="Lightning Bolt…"
        aria-label="Card name"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />

      <div className="filters">
        <input
          type="text"
          placeholder="Type (e.g. creature)"
          aria-label="Type line contains"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <div role="group" aria-label="Color identity">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={colors.includes(c) ? "color on" : "color"}
              aria-pressed={colors.includes(c)}
              title={COLOR_NAMES[c]}
              onClick={() => toggle(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {!enabled && <p className="hint">Type at least 2 characters.</p>}
      {enabled && error && <p className="error">Could not search: {error.message}</p>}
      {enabled && isFetching && <p className="hint">Searching…</p>}
      {enabled && !isFetching && !error && data?.length === 0 && <p className="hint">No cards found.</p>}

      <ul className="results">
        {enabled &&
          data?.map((card) => (
            <li key={card.oracleId}>
              {card.image ? (
                <button
                  type="button"
                  className="thumb"
                  aria-label={`Show ${card.name}`}
                  onClick={() => setPreview(card)}
                >
                  <img src={card.image.small} alt="" loading="lazy" width={63} height={88} />
                </button>
              ) : (
                <button type="button" className="thumb empty" aria-label={`Show ${card.name}`} onClick={() => setPreview(card)} />
              )}
              <div className="info">
                <div className="name">
                  {card.name} <span className="mana">{card.manaCost}</span>
                </div>
                <div className="type">{card.typeLine}</div>
              </div>
            </li>
          ))}
      </ul>

      {preview && <CardDetail card={preview} onClose={() => setPreview(null)} />}

      <footer className="credit">
        Card images are provided by <a href="https://scryfall.com">Scryfall</a>. Magic: The Gathering is
        © Wizards of the Coast.
      </footer>
    </main>
  );
}
