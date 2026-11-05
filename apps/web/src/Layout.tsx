import { Link, Outlet } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { AuthBar } from "./AuthBar";
import { LOCALE_NAME, LOCALES, setLocale, useI18n } from "./i18n";

const NAV = [
  { to: "/search", label: "nav.search", hint: "nav.search.hint" },
  { to: "/collection", label: "nav.collection", hint: "nav.collection.hint" },
  { to: "/decks", label: "nav.decks", hint: "nav.decks.hint" },
  { to: "/scan", label: "nav.scan", hint: "nav.scan.hint" },
] as const;

/** App frame: brand and account on top, navigation at the bottom on phones and on top on wide screens. */
export function Layout() {
  const { t, locale } = useI18n();
  const bar = useRef<HTMLElement>(null);
  // Sticky things under the top bar (the commander bar) need its real height, which changes with the language,
  // the font and the screen. Publish it as `--topbar-h`.
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty("--topbar-h", `${el.getBoundingClientRect().height}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const other = LOCALES.find((l) => l !== locale)!;
  return (
    <div className="app">
      <header className="topbar" ref={bar}>
        <div className="topbar-left">
          <Link to="/" className="brand">
            mtg<span>·</span>vault
          </Link>
          <nav className="nav" aria-label={t("nav.aria")}>
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} title={t(item.hint)} activeOptions={{ exact: true }}>
                {t(item.label)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <Link to="/appearance" className="icon-link" aria-label={t("appearance.link")} title={t("appearance.linkHint")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.2-9-7.2Z" />
              <circle cx="7.5" cy="11" r="1" />
              <circle cx="10.5" cy="7.5" r="1" />
              <circle cx="15" cy="7.5" r="1" />
            </svg>
          </Link>
          <button
            type="button"
            className="lang"
            lang={other}
            aria-label={LOCALE_NAME[other]}
            title={LOCALE_NAME[other]}
            onClick={() => setLocale(other)}
          >
            {other.toUpperCase()}
          </button>
          <AuthBar />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
