import { Link, Outlet } from "@tanstack/react-router";
import { AuthBar } from "./AuthBar";

const NAV = [
  { to: "/", label: "Search", hint: "Find any card and see its printings and prices" },
  { to: "/collection", label: "Collection", hint: "The cards you own and what they are worth" },
  { to: "/decks", label: "Decks", hint: "Build decks and see which cards you already own" },
] as const;

/** App frame: brand and account on top, navigation at the bottom on phones and on top on wide screens. */
export function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand">
            mtg<span>·</span>vault
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} title={item.hint} activeOptions={{ exact: true }}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <Link to="/appearance" className="icon-link" aria-label="Appearance" title="Appearance: mode, background color and card art">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.2-9-7.2Z" />
              <circle cx="7.5" cy="11" r="1" />
              <circle cx="10.5" cy="7.5" r="1" />
              <circle cx="15" cy="7.5" r="1" />
            </svg>
          </Link>
          <AuthBar />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
