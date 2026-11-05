import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fetchMe } from "./auth";
import { useI18n } from "./i18n";
import "./landing.css";

/** Real card pictures, hotlinked from Scryfall like everywhere else in the app (credit in the footer). */
const FAN = [
  { name: "Counterspell", src: "https://cards.scryfall.io/normal/front/4/f/4f616706-ec97-4923-bb1e-11a69fbaa1f8.jpg?1783909630" },
  { name: "Llanowar Elves", src: "https://cards.scryfall.io/normal/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.jpg?1783909057" },
  { name: "Lightning Bolt", src: "https://cards.scryfall.io/normal/front/7/6/7673784e-db4b-43a1-8d55-1bb9fc1e284f.jpg?1783903008" },
  { name: "Sol Ring", src: "https://cards.scryfall.io/normal/front/f/c/fc817e07-c1f3-469f-9cf7-0945dea7400f.jpg?1793021181" },
  { name: "Swords to Plowshares", src: "https://cards.scryfall.io/normal/front/4/6/4645eebf-c9fc-4ee7-b646-61dc1205b4b0.jpg?1793111861" },
] as const;

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);
const ICONS = {
  collection: svg(<><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="14" width="8" height="6" rx="1.5" /></>),
  import: svg(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></>),
  scanner: svg(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>),
  decks: svg(<><rect x="5" y="3" width="11" height="15" rx="1.5" /><path d="M8 21h11a1 1 0 0 0 1-1V8" /></>),
  commander: svg(<><path d="m4 8 4 3 4-6 4 6 4-3-2 10H6L4 8Z" /></>),
  prices: svg(<><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.4-.8-1.4-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.4 5 1.1 5 3.6 0 1.1-1.1 1.8-2.6 1.8-1.2 0-2.2-.5-2.6-1.4M12 6.5V8m0 8v1.5" /></>),
  art: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-8 8" /></>),
  language: svg(<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.5 5.2 3.5 8.5s-1 6.1-3.5 8.5c-2.5-2.4-3.5-5.2-3.5-8.5S9.5 5.9 12 3.5Z" /></>),
};
const FEATURES = ["collection", "import", "scanner", "decks", "commander", "prices", "art", "language"] as const;
const FAQS = ["official", "data", "moxfield", "photos", "accuracy", "phone"] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

/** What the page offers a visitor: join, or carry on into the app when already signed in. */
function Actions({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  return signedIn ? (
    <>
      <Link to="/collection" className="button landing-primary">
        {t("landing.cta.collection")}
      </Link>
      <Link to="/search" className="landing-secondary">
        {t("landing.cta.search")}
      </Link>
    </>
  ) : (
    <>
      <Link to="/login" search={{ mode: "register" }} className="button landing-primary">
        {t("landing.cta.create")}
      </Link>
      <Link to="/search" className="landing-secondary">
        {t("landing.cta.search")}
      </Link>
    </>
  );
}

export function LandingPage() {
  const { t } = useI18n();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const signedIn = !!me;

  return (
    <main className="landing">
      <section className="l-hero" aria-labelledby="l-hero-title">
        <div className="l-hero-copy">
          <p className="l-eyebrow">{t("landing.hero.eyebrow")}</p>
          <h1 id="l-hero-title">{t("landing.hero.title")}</h1>
          <p className="l-lead">{t("landing.hero.lead")}</p>
          <div className="l-actions">
            <Actions signedIn={signedIn} />
            <button type="button" className="l-ghost" onClick={() => scrollToId("how")}>
              {t("landing.cta.how")}
            </button>
          </div>
          <p className="l-note">{t("landing.hero.note")}</p>
        </div>
        <div className="l-fan" aria-hidden="true">
          {FAN.map((c, i) => (
            <img key={c.name} className={`fan-${i}`} src={c.src} alt="" loading={i === 2 ? "eager" : "lazy"} decoding="async" />
          ))}
        </div>
      </section>

      <section className="l-facts" aria-label={t("landing.facts.aria")}>
        {(["art", "printings", "languages", "photos"] as const).map((f) => (
          <div key={f} className="l-fact">
            <b>{t(`landing.fact.${f}.value`)}</b>
            <span>{t(`landing.fact.${f}.label`)}</span>
          </div>
        ))}
      </section>

      <section className="l-section" id="features" aria-labelledby="l-features-title">
        <h2 id="l-features-title">{t("landing.features.title")}</h2>
        <p className="l-section-lead">{t("landing.features.lead")}</p>
        <ul className="l-features">
          {FEATURES.map((f) => (
            <li key={f}>
              <span className="l-icon">{ICONS[f]}</span>
              <h3>{t(`landing.feature.${f}.title`)}</h3>
              <p>{t(`landing.feature.${f}.text`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="l-section l-how" id="how" aria-labelledby="l-how-title">
        <h2 id="l-how-title">{t("landing.how.title")}</h2>
        <ol className="l-steps">
          {(["add", "organise", "build", "improve"] as const).map((s, i) => (
            <li key={s}>
              <span className="l-step-n" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{t(`landing.step.${s}.title`)}</h3>
              <p>{t(`landing.step.${s}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="l-section l-dive" aria-labelledby="l-scan-title">
        <div className="l-dive-copy">
          <h2 id="l-scan-title">{t("landing.scan.title")}</h2>
          <p>{t("landing.scan.text")}</p>
          <ul className="l-checks">
            {(["b1", "b2", "b3"] as const).map((b) => (
              <li key={b}>{t(`landing.scan.${b}`)}</li>
            ))}
          </ul>
        </div>
        <figure className="l-mock" aria-hidden="true">
          <div className="mock-scan">
            <div className="mock-frame">
              <img src={FAN[2].src} alt="" loading="lazy" decoding="async" />
            </div>
            <div className="mock-meter">
              <span />
            </div>
            <div className="mock-toast">Lightning Bolt · $0.50</div>
          </div>
          <figcaption>{t("landing.example")}</figcaption>
        </figure>
      </section>

      <section className="l-section l-dive l-reverse" aria-labelledby="l-deck-title">
        <div className="l-dive-copy">
          <h2 id="l-deck-title">{t("landing.deck.title")}</h2>
          <p>{t("landing.deck.text")}</p>
          <ul className="l-checks">
            {(["b1", "b2", "b3"] as const).map((b) => (
              <li key={b}>{t(`landing.deck.${b}`)}</li>
            ))}
          </ul>
        </div>
        <figure className="l-mock" aria-hidden="true">
          <div className="mock-deck">
            <div className="mock-deck-head">
              <b>Temur · Commander</b>
              <span>86 / 100</span>
            </div>
            <div className="deck-progress">
              <i style={{ width: "86%" }} />
            </div>
            <div className="type-bar">
              {[
                ["Commander", 1],
                ["Creature", 28],
                ["Instant", 11],
                ["Sorcery", 8],
                ["Artifact", 9],
                ["Land", 29],
              ].map(([cat, n]) => (
                <span key={cat as string} data-cat={cat as string} style={{ flexGrow: n as number }} />
              ))}
            </div>
            <div className="mock-curve">
              {[3, 9, 14, 11, 7, 4, 2, 1].map((h, i) => (
                <div key={i}>
                  <span style={{ height: `${h * 6}px` }} />
                  <small>{i === 7 ? "7+" : i}</small>
                </div>
              ))}
            </div>
            <div className="mock-tiles">
              <div><b>36</b><small>lands / ~38</small></div>
              <div><b>10</b><small>ramp</small></div>
              <div><b>9</b><small>card draw</small></div>
            </div>
          </div>
          <figcaption>{t("landing.example")}</figcaption>
        </figure>
      </section>

      <section className="l-section l-dive" aria-labelledby="l-find-title">
        <div className="l-dive-copy">
          <h2 id="l-find-title">{t("landing.find.title")}</h2>
          <p>{t("landing.find.text")}</p>
          <ul className="l-checks">
            {(["b1", "b2", "b3"] as const).map((b) => (
              <li key={b}>{t(`landing.find.${b}`)}</li>
            ))}
          </ul>
        </div>
        <figure className="l-mock" aria-hidden="true">
          <div className="mock-find">
            <div className="mock-search">Lightning</div>
            <div className="mock-chips">
              {["All 934", "Creature 312", "Instant 148", "Land 96"].map((c, i) => (
                <span key={c} className={i === 2 ? "on" : undefined}>
                  {c}
                </span>
              ))}
            </div>
            <div className="mock-chips">
              {["0", "1", "2", "3", "4", "5", "6", "7+"].map((c, i) => (
                <span key={c} className={i === 1 ? "on small" : "small"}>
                  {c}
                </span>
              ))}
            </div>
            {[FAN[2], FAN[1], FAN[3]].map((c, i) => (
              <div key={c.name} className="mock-row">
                <img src={c.src} alt="" loading="lazy" decoding="async" />
                <div>
                  <b>{c.name}</b>
                  <small>{["Instant · NM", "Creature — Elf Druid · NM", "Artifact · LP"][i]}</small>
                </div>
                <span>×{[4, 2, 1][i]}</span>
              </div>
            ))}
          </div>
          <figcaption>{t("landing.example")}</figcaption>
        </figure>
      </section>

      <section className="l-section l-faq" id="faq" aria-labelledby="l-faq-title">
        <h2 id="l-faq-title">{t("landing.faq.title")}</h2>
        <div className="l-faq-list">
          {FAQS.map((q) => (
            <details key={q}>
              <summary>{t(`landing.faq.${q}.q`)}</summary>
              <p>{t(`landing.faq.${q}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="l-final" aria-labelledby="l-final-title">
        <h2 id="l-final-title">{t("landing.final.title")}</h2>
        <p>{t("landing.final.text")}</p>
        <div className="l-actions center">
          <Actions signedIn={signedIn} />
        </div>
      </section>

      <footer className="l-footer">
        <p>{t("landing.footer")}</p>
      </footer>
    </main>
  );
}
