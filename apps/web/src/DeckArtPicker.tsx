import { useQuery } from "@tanstack/react-query";
import { fetchPrintings } from "./api";
import { printingLabel, releaseYear } from "./format";
import { useI18n } from "./i18n";

/** Every printing of a deck card as a strip of pictures: pick the one whose art you want to see in the deck. */
export function DeckArtPicker(props: { oracleId: string; current: string | null; busy: boolean; onPick: (printingId: string) => void }) {
  const { t } = useI18n();
  const { data: printings, error } = useQuery({
    queryKey: ["printings", props.oracleId],
    queryFn: ({ signal }) => fetchPrintings(props.oracleId, signal),
    staleTime: 5 * 60_000,
  });
  return (
    <div className="deck-art-picker">
      {!printings && !error && <p className="hint">{t("detail.loading")}</p>}
      {error && <p className="error">{error.message}</p>}
      <ul className="printing-strip">
        {printings?.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={p.id === props.current ? "strip-item on" : "strip-item"}
              aria-pressed={p.id === props.current}
              aria-label={p.flavorName ? `${printingLabel(p)} — ${p.flavorName}` : printingLabel(p)}
              title={`${printingLabel(p)} · ${releaseYear(p.releasedAt)} · ${p.lang}${p.flavorName ? ` · ${p.flavorName}` : ""}`}
              disabled={props.busy}
              onClick={() => props.onPick(p.id)}
            >
              {p.image ? <img src={p.image.small} alt="" loading="lazy" /> : <span className="thumb-ph" aria-hidden="true" />}
              <span>{p.setCode.toUpperCase()}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
