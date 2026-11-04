import type { CardSearchResult } from "@mtg-vault/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AddToCollection } from "./AddToCollection";
import { fetchPrintings } from "./api";
import { priceLine, printingLabel, releaseYear } from "./format";
import { useI18n } from "./i18n";

/** Dialog with the card image and every printing of the card, with set name and price. */
export function CardDetail({ card, onClose }: { card: CardSearchResult; onClose: () => void }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: printings, isLoading, error } = useQuery({
    queryKey: ["cards", card.oracleId, "printings"],
    queryFn: ({ signal }) => fetchPrintings(card.oracleId, signal),
  });

  const selected = printings?.find((p) => p.id === selectedId) ?? printings?.[0];
  const image = selected?.image ?? card.image;

  return (
    <div className="overlay" role="dialog" aria-label={card.name} onClick={onClose}>
      <div className="detail" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{card.name}</h2>
          <button type="button" className="close" aria-label={t("detail.close")} onClick={onClose}>
            ×
          </button>
        </header>
        <div className="detail-body">
          {image && <img className="detail-image" src={image.normal} alt={card.name} />}
          <div className="printings">
            {isLoading && <p className="hint">{t("detail.loading")}</p>}
            {error && <p className="error">{error.message}</p>}
            {selected && <AddToCollection key={selected.id} printing={selected} />}
            {printings && <p className="hint">{t("detail.count", { count: printings.length })}</p>}
            <ul>
              {printings?.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={p.id === selected?.id ? "printing on" : "printing"}
                    aria-pressed={p.id === selected?.id}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="printing-name">{printingLabel(p)}</span>
                    <span className="printing-meta">
                      {[releaseYear(p.releasedAt), p.rarity, p.finishes.join("/"), p.lang !== "en" ? p.lang : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="printing-price">{priceLine(p.prices) ?? t("price.none")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
