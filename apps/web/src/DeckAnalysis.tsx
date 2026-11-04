import {
  analyzeCommanderDeck,
  BRACKETS,
  LAND_FORMULA,
  ROLES,
  ROLE_TARGETS,
  SOURCES,
  type DeckCardEntry,
  type Role,
  type Warning,
  type WarningCode,
} from "@mtg-vault/shared";
import { useI18n } from "./i18n";
import { edhrecUrl, openSideWindow } from "./edhrec";
import { ManaCost } from "./ManaCost";
import { Tip } from "./Tip";

const WARNING_KEY = {
  size: "analysis.warn.size",
  "no-commander": "analysis.warn.no-commander",
  "many-commanders": "analysis.warn.many-commanders",
  colors: "analysis.warn.colors",
  copies: "analysis.warn.copies",
  "lands-low": "analysis.warn.lands-low",
  "lands-high": "analysis.warn.lands-high",
  "role-low": "analysis.warn.role-low",
  "role-high": "analysis.warn.role-high",
} as const satisfies Record<WarningCode, string>;

const ROLE_STAT_KEY = {
  ramp: "analysis.stat.ramp",
  draw: "analysis.stat.draw",
  removal: "analysis.stat.removal",
  wipe: "analysis.stat.wipe",
} as const satisfies Record<Role, string>;

const ROLE_NAME_KEY = {
  ramp: "analysis.role.ramp",
  draw: "analysis.role.draw",
  removal: "analysis.role.removal",
  wipe: "analysis.role.wipe",
} as const satisfies Record<Role, string>;

const BRACKET_NAME_KEY = { 1: "bracket.1.name", 2: "bracket.2.name", 3: "bracket.3.name", 4: "bracket.4.name", 5: "bracket.5.name" } as const;
const BRACKET_TEXT_KEY = { 1: "bracket.1.text", 2: "bracket.2.text", 3: "bracket.3.text", 4: "bracket.4.text", 5: "bracket.5.text" } as const;
const CONFIDENCE_KEY = {
  official: "analysis.confidence.official",
  simulation: "analysis.confidence.simulation",
  community: "analysis.confidence.community",
  assumption: "analysis.confidence.assumption",
} as const;

const SHOWN_SOURCES = ["karsten", "landSimulation", "template", "brackets"] as const;

/** Mana value shown under a curve bar; the last slot is "7 or more". */
const slotLabel = (index: number, slots: number) => (index === slots - 1 ? `${index}+` : String(index));

/**
 * Summary of a Commander deck: commander and colors, lands against the suggested count, roles, mana curve,
 * rule and advice warnings, a link to the commander on EDHREC and a guide to the brackets.
 * Everything here is a guide; no warning blocks anything.
 */
export function DeckAnalysis({ cards }: { cards: DeckCardEntry[] }) {
  const { t, locale } = useI18n();
  const a = analyzeCommanderDeck(cards);
  const number = (value: number, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const peak = Math.max(1, ...a.curve);
  const rules = a.warnings.filter((w) => w.kind === "rule");
  const advice = a.warnings.filter((w) => w.kind === "advice");

  const warningText = (w: Warning) => {
    const params = { ...w.params };
    if (typeof params.role === "string") params.role = t(ROLE_NAME_KEY[params.role as Role]);
    return t(WARNING_KEY[w.code], params);
  };

  return (
    <section className="analysis" aria-label={t("analysis.title")}>
      <h2 className="group-title">
        {t("analysis.title")}
        <Tip label={t("analysis.tip.label")}>{t("analysis.tip.text")}</Tip>
      </h2>

      {a.commanders.length === 0 ? (
        <p className="hint">{t("analysis.noCommander")}</p>
      ) : (
        <>
          <p className="analysis-commander">
            {t("analysis.commander", { names: a.commanders.join(" · ") })}
            <span className="identity">
              <span className="sub">{t("analysis.identity")}</span>{" "}
              {a.identity.length ? <ManaCost cost={a.identity.map((c) => `{${c}}`).join("")} /> : <span className="sub">{t("analysis.colorless")}</span>}
            </span>
          </p>
          <div className="analysis-links">
            <span className="filter-title">
              {t("analysis.edhrec.title")}
              <Tip label={t("analysis.edhrec.tip.label")}>{t("analysis.edhrec.tip.text")}</Tip>
            </span>
            {a.commanders.map((name) => (
              <span key={name} className="analysis-link">
                <a href={edhrecUrl(name)} target="_blank" rel="noopener noreferrer">
                  {t("analysis.edhrec.link", { name })} ↗
                </a>
                <button
                  type="button"
                  className="link"
                  aria-label={t("analysis.edhrec.windowAria", { name })}
                  onClick={() => openSideWindow(edhrecUrl(name))}
                >
                  {t("analysis.edhrec.window")}
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      <div className="stats analysis-stats">
        <div className="stat">
          <b>{a.lands}</b>
          <span>
            {t("analysis.stat.lands", { suggested: a.suggestedLands })}
            <Tip label={t("analysis.lands.tip.label")}>
              {t("analysis.lands.tip.text", {
                base: number(LAND_FORMULA.base, 2),
                perMv: number(LAND_FORMULA.perAverageMv, 2),
                perCheap: number(LAND_FORMULA.perCheapSpell, 2),
                cheap: LAND_FORMULA.cheapMaxMv,
              })}
            </Tip>
          </span>
        </div>
        <div className="stat">
          <b>{number(a.averageMv)}</b>
          <span>{t("analysis.stat.avg")}</span>
        </div>
        {ROLES.map((role) => (
          <div key={role} className="stat">
            <b>{a.roles[role]}</b>
            <span>{t(ROLE_STAT_KEY[role], ROLE_TARGETS[role])}</span>
          </div>
        ))}
      </div>

      <h3 className="analysis-sub">
        {t("analysis.curve.title")}
        <Tip label={t("analysis.curve.tip.label")}>{t("analysis.curve.tip.text")}</Tip>
      </h3>
      {a.spells === 0 ? (
        <p className="hint">{t("analysis.curve.empty")}</p>
      ) : (
        <ul className="curve">
          {a.curve.map((count, i) => (
            <li key={i} aria-label={t("analysis.curve.slot", { mv: slotLabel(i, a.curve.length), count })}>
              <span className="curve-count" aria-hidden="true">
                {count}
              </span>
              <span className="curve-bar" aria-hidden="true" style={{ height: `${Math.round((count / peak) * 100)}%` }} />
              <span className="curve-mv" aria-hidden="true">
                {slotLabel(i, a.curve.length)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="analysis-sub">{t("analysis.warnings.title")}</h3>
      {a.warnings.length === 0 ? (
        <p className="ok">{t("analysis.warnings.none")}</p>
      ) : (
        <>
          <WarningList title={t("analysis.warnings.rules")} items={rules.map(warningText)} />
          <WarningList title={t("analysis.warnings.advice")} items={advice.map(warningText)} />
          <p className="hint">{t("analysis.warnings.note")}</p>
        </>
      )}

      <details className="analysis-more">
        <summary>{t("analysis.brackets.title")}</summary>
        <p className="hint">{t("analysis.brackets.intro")}</p>
        <ul className="brackets">
          {BRACKETS.map((b) => (
            <li key={b.level}>
              <b>
                {b.level} · {t(BRACKET_NAME_KEY[b.level])}
              </b>{" "}
              <span className="sub">
                {t("analysis.brackets.limit", {
                  limit:
                    b.gameChangerLimit === null
                      ? t("analysis.gc.any")
                      : b.gameChangerLimit === 0
                        ? t("analysis.gc.none")
                        : t("analysis.gc.upTo", { count: b.gameChangerLimit }),
                })}
              </span>
              <br />
              {t(BRACKET_TEXT_KEY[b.level])}
            </li>
          ))}
        </ul>
        <p className="hint">
          {t("analysis.brackets.note")}{" "}
          <a href={SOURCES.brackets.url} target="_blank" rel="noopener noreferrer">
            {t("analysis.brackets.official")} ↗
          </a>
        </p>
      </details>

      <details className="analysis-more">
        <summary>{t("analysis.sources.title")}</summary>
        <ul className="sources">
          {SHOWN_SOURCES.map((id) => (
            <li key={id}>
              <a href={SOURCES[id].url} target="_blank" rel="noopener noreferrer">
                {SOURCES[id].title} ↗
              </a>{" "}
              <span className="badge">{t(CONFIDENCE_KEY[SOURCES[id].confidence])}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function WarningList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="warning-group">
      <h4>{title}</h4>
      <ul className="warnings">
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
