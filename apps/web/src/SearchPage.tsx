import { colorSchema, type CardSearchResult, type Color } from "@mtg-vault/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchCards } from "./api";
import { CardDetail } from "./CardDetail";
import { ManaCost } from "./ManaCost";
import { Tip } from "./Tip";
import { Welcome } from "./Welcome";
import { useDebouncedValue } from "./useDebouncedValue";

const COLORS = colorSchema.options;
const COLOR_NAMES: Record<Color, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

/** Card types people search for most; the type box accepts any word of the type line. */
export const CARD_TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];

/** Plain-words summary of the color buttons, so it is clear what they do. */
export function describeColors(colors: Color[]): string {
  if (colors.length === 0) return "No color picked: cards of any color.";
  const names = colors.map((c) => COLOR_NAMES[c]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return colors.length === 1 ? `Cards that have ${list}.` : `Cards that have all of: ${list}.`;
}

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
      <h1>Search cards</h1>
      <p className="subtitle">
        Find any Magic card by name, even with typos.
        <Tip label="search">
          Type part of a name; small typos are fine. Open a card to see every printing with its art and price, and
          add copies to your collection.
        </Tip>
      </p>
      <Welcome />

      <div className="searchbox">
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
          <div className="filter">
            <span className="filter-title">
              Card type
              <Tip label="card type">
                Keeps cards whose type line contains the word. Pick one below or type your own, such as a creature
                type (goblin, elf, dragon), an artifact type (equipment) or legendary.
              </Tip>
            </span>
            <input
              type="text"
              placeholder="Type (e.g. creature)"
              aria-label="Type line contains"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <div className="chips" role="group" aria-label="Common card types">
              {CARD_TYPES.map((t) => {
                const on = type.trim().toLowerCase() === t.toLowerCase();
                return (
                  <button
                    key={t}
                    type="button"
                    className={on ? "chip on" : "chip"}
                    aria-pressed={on}
                    onClick={() => setType(on ? "" : t)}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="filter">
            <span className="filter-title">
              Colors
              <Tip label="colors">
                Pick the colors a card must have. With two or more, it must have all of them: Red + Green finds
                red-green cards (and ones with more colors), not every red or green card. Lands and colorless cards
                have no color, so pick none to see them.
              </Tip>
            </span>
            <div className="colors" role="group" aria-label="Color identity">
              {COLORS.map((c) => (
                <div key={c} className="color-item">
                  <button
                    type="button"
                    className={`color pip-${c.toLowerCase()}${colors.includes(c) ? " on" : ""}`}
                    aria-pressed={colors.includes(c)}
                    title={COLOR_NAMES[c]}
                    onClick={() => toggle(c)}
                  >
                    {c}
                  </button>
                  <span className="color-name" aria-hidden="true">
                    {COLOR_NAMES[c]}
                  </span>
                </div>
              ))}
            </div>
            <p className="hint filter-summary">{describeColors(colors)}</p>
          </div>
        </div>
      </div>

      {!enabled && <p className="hint">Type at least 2 characters.</p>}
      {enabled && error && <p className="error">Could not search: {error.message}</p>}
      {enabled && isFetching && <p className="hint">Searching…</p>}
      {enabled && !isFetching && !error && data?.length === 0 && <p className="hint">No cards found.</p>}

      <ul className="results">
        {enabled &&
          data?.map((card) => (
            <li key={card.oracleId} className="tile">
              <button
                type="button"
                className={card.image ? "tile-btn" : "tile-btn empty"}
                aria-label={`Show ${card.name}`}
                onClick={() => setPreview(card)}
              >
                {card.image ? <img src={card.image.small} alt="" loading="lazy" /> : "No image"}
              </button>
              <div className="tile-info">
                <div className="name">{card.name}</div>
                <ManaCost cost={card.manaCost} />
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
