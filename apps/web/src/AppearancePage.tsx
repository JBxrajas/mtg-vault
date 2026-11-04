import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchCards } from "./api";
import {
  BACKGROUNDS,
  DIMMING_MAX,
  DIMMING_MIN,
  isArtUrl,
  setAppearance,
  useAppearance,
  type Background,
  type Mode,
} from "./appearance";
import { Tip } from "./Tip";
import { useDebouncedValue } from "./useDebouncedValue";

const MODES: { value: Mode; label: string }[] = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const BACKGROUND_LABEL: Record<Background, string> = {
  default: "Neutral",
  white: "White",
  blue: "Blue",
  black: "Black",
  red: "Red",
  green: "Green",
  gold: "Gold",
};

/** Lets the user pick light or dark, a background tint, or the art of a card. Saved on this device. */
export function AppearancePage() {
  const appearance = useAppearance();
  const [text, setText] = useState("");
  const q = useDebouncedValue(text.trim(), 300);
  const { data, isFetching, error } = useQuery({
    queryKey: ["cards", "search", "art", q],
    queryFn: ({ signal }) => searchCards({ q, limit: 12 }, signal),
    enabled: q.length >= 2,
  });
  const results = (data ?? []).filter((c) => isArtUrl(c.image?.artCrop));

  return (
    <main className="page">
      <h1>Appearance</h1>
      <p className="subtitle">
        Make it yours. This is saved on this device only.
        <Tip label="appearance">
          Pick a mode and a background color, or use the art of any Magic card as your background. Your choice stays
          in this browser: other devices keep their own.
        </Tip>
      </p>

      <section className="panel" aria-labelledby="mode-title">
        <h2 id="mode-title">Mode</h2>
        <div className="segmented" role="group" aria-label="Mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={appearance.mode === m.value}
              className={appearance.mode === m.value ? "on" : ""}
              onClick={() => setAppearance({ mode: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="hint">Automatic follows your device's light or dark setting.</p>
      </section>

      <section className="panel" aria-labelledby="color-title">
        <h2 id="color-title">Background color</h2>
        <div className="swatches" role="group" aria-label="Background color">
          {BACKGROUNDS.map((b) => (
            <button
              key={b}
              type="button"
              className={`swatch swatch-${b}${appearance.background === b ? " on" : ""}`}
              aria-pressed={appearance.background === b}
              onClick={() => setAppearance({ background: b, art: null })}
            >
              <span className="swatch-dot" aria-hidden="true" />
              {BACKGROUND_LABEL[b]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="art-title">
        <h2 id="art-title">Card art</h2>
        <p className="hint">Search a card and use its art as the background.</p>
        <input
          className="search"
          type="search"
          aria-label="Search card art"
          placeholder="Black Lotus, Sol Ring…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {q.length >= 2 && isFetching && <p className="hint">Searching…</p>}
        {q.length >= 2 && error && <p className="error">Could not search: {error.message}</p>}
        {q.length >= 2 && !isFetching && !error && results.length === 0 && <p className="hint">No art found.</p>}
        <ul className="art-grid">
          {results.map((c) => (
            <li key={c.oracleId}>
              <button
                type="button"
                className="art-tile"
                aria-label={`Use the art of ${c.name}`}
                onClick={() => setAppearance({ art: { url: c.image!.artCrop, name: c.name } })}
              >
                <img src={c.image!.artCrop} alt="" loading="lazy" />
                <span>{c.name}</span>
              </button>
            </li>
          ))}
        </ul>

        {appearance.art && (
          <div className="art-current">
            <p>
              Using the art of <strong>{appearance.art.name}</strong>.
            </p>
            <div className="slider">
              <span>
                Dimming
                <Tip label="dimming">How much the page color covers the art. Raise it if text is hard to read.</Tip>
              </span>
              <input
                type="range"
                aria-label="Dimming"
                min={DIMMING_MIN}
                max={DIMMING_MAX}
                value={appearance.dimming}
                onChange={(e) => setAppearance({ dimming: Number(e.target.value) })}
              />
            </div>
            <button type="button" className="link" onClick={() => setAppearance({ art: null })}>
              Remove the art
            </button>
          </div>
        )}
      </section>

      <button
        type="button"
        className="link"
        onClick={() => setAppearance({ mode: "system", background: "default", art: null })}
      >
        Reset to the default look
      </button>
    </main>
  );
}
