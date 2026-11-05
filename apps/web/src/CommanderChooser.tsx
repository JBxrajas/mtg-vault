import {
  canPartner,
  colorIdentityName,
  colorWords,
  commanderRefusal,
  commanderRole,
  type CardImage,
  type CardSearchResult,
  type CommanderCandidate,
  type PrintingSummary,
} from "@mtg-vault/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPrintings, searchCards } from "./api";
import { printingLabel, releaseYear } from "./format";
import { useI18n } from "./i18n";
import { ManaCost } from "./ManaCost";
import { useDebouncedValue } from "./useDebouncedValue";

export interface CommanderChoice {
  card: CardSearchResult;
  /** The printing whose art the player picked, or null for the default one. */
  printingId: string | null;
  /** Image of that printing, to show the choice. */
  image: CardImage | null;
}

type Refusal = "not-legendary" | "not-creature" | "no-partner" | "background-alone";

/** Why this card cannot be picked, given the commander(s) already chosen. Null when it can. */
export function refusalFor(card: CommanderCandidate, existing: CommanderCandidate[]): Refusal | null {
  const own = commanderRefusal(card);
  if (own) return own;
  if (existing.length === 0) return commanderRole(card) === "background" ? "background-alone" : null;
  return canPartner(existing[0]!, card) ? null : "no-partner";
}

/**
 * Picks a commander visually: search, a grid of legendary cards (those that cannot lead are greyed out and say why),
 * then the chosen card large with every printing to choose its art from. `existing` holds the commander already
 * chosen when this picks a partner.
 */
export function CommanderChooser(props: { existing?: CommanderCandidate[]; busy?: boolean; onChoose: (choice: CommanderChoice) => void }) {
  const { t } = useI18n();
  const existing = props.existing ?? [];
  const [text, setText] = useState("");
  const q = useDebouncedValue(text.trim(), 300);
  const [picked, setPicked] = useState<CardSearchResult | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { data: results, isFetching } = useQuery({
    queryKey: ["cards", "search", "commander", q],
    queryFn: ({ signal }) => searchCards({ q, limit: 12, type: "legendary" }, signal),
    enabled: q.length >= 2,
  });
  const { data: printings } = useQuery({
    queryKey: ["cards", picked?.oracleId, "printings"],
    queryFn: ({ signal }) => fetchPrintings(picked!.oracleId, signal),
    enabled: !!picked,
  });
  const printing: PrintingSummary | undefined = printings?.find((p) => p.id === printingId) ?? printings?.find((p) => p.image) ?? printings?.[0];
  const image = printing?.image ?? picked?.image ?? null;
  const pickedRefusal = picked ? refusalFor(picked, existing) : null;
  // An older API (during a deploy) may answer without colors: show none rather than fail.
  const identity = picked?.colorIdentity ?? [];

  return (
    <div className="chooser">
      <input
        type="search"
        aria-label={t("chooser.search")}
        placeholder={t("chooser.placeholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {q.length >= 2 && isFetching && <p className="hint">{t("search.searching")}</p>}
      {q.length >= 2 && results?.length === 0 && <p className="hint">{t("search.none")}</p>}

      <ul className="chooser-grid">
        {q.length >= 2 &&
          results?.map((c) => {
            const refusal = refusalFor(c, existing);
            return (
              <li key={c.oracleId}>
                <button
                  type="button"
                  className={c.oracleId === picked?.oracleId ? "chooser-card on" : "chooser-card"}
                  aria-pressed={c.oracleId === picked?.oracleId}
                  aria-disabled={refusal ? true : undefined}
                  disabled={!!refusal}
                  onClick={() => {
                    setPicked(c);
                    setPrintingId(null);
                  }}
                >
                  {c.image ? <img src={c.image.small} alt="" loading="lazy" /> : <span className="thumb-ph" aria-hidden="true" />}
                  <span className="chooser-name">{c.name}</span>
                  {refusal && <span className="chooser-refusal">{t(`chooser.refusal.${refusal}`)}</span>}
                </button>
              </li>
            );
          })}
      </ul>

      {picked && (
        <section className="chooser-picked" aria-label={t("chooser.selected", { name: picked.name })}>
          {image ? <img className="chooser-big" src={image.normal} alt={picked.name} /> : <div className="chooser-big thumb-ph" aria-hidden="true" />}
          <div className="chooser-side">
            <h3>{picked.name}</h3>
            <ManaCost cost={picked.manaCost} />
            <p className="sub">{picked.typeLine}</p>
            <p className="identity-line">
              <ManaCost cost={identity.map((c) => `{${c}}`).join("")} />{" "}
              <b>{colorIdentityName(identity)}</b>
              {identity.length > 0 && <span className="sub"> — {colorWords(identity).join(", ")}</span>}
            </p>
            <h4>{t("chooser.printings")}</h4>
            {!printings && <p className="hint">{t("detail.loading")}</p>}
            <ul className="printing-strip">
              {printings?.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={p.id === printing?.id ? "strip-item on" : "strip-item"}
                    aria-pressed={p.id === printing?.id}
                    aria-label={printingLabel(p)}
                    title={`${printingLabel(p)} · ${releaseYear(p.releasedAt)}`}
                    onClick={() => setPrintingId(p.id)}
                  >
                    {p.image ? <img src={p.image.small} alt="" loading="lazy" /> : <span className="thumb-ph" aria-hidden="true" />}
                    <span>{p.setCode.toUpperCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-primary"
              disabled={props.busy || !!pickedRefusal}
              onClick={() => props.onChoose({ card: picked, printingId: printing?.id ?? null, image })}
            >
              {t("chooser.use", { name: picked.name })}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
