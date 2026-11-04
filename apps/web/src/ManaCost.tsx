/** A mana cost such as "{2}{W/U}{R}" drawn as small coloured pips. */
export function ManaCost({ cost }: { cost: string | null }) {
  if (!cost) return null;
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
  return (
    <span className="mana" role="img" aria-label={cost}>
      {symbols.map((s, i) => (
        <span key={i} className={`pip ${pipClass(s)}`} aria-hidden="true">
          {s.replace("/", "")}
        </span>
      ))}
    </span>
  );
}

/** Colour of a symbol: its first coloured letter (hybrid and Phyrexian symbols included), else neutral. */
export function pipClass(symbol: string): string {
  const color = symbol.toUpperCase().match(/[WUBRG]/)?.[0];
  return color ? `pip-${color.toLowerCase()}` : "pip-n";
}
