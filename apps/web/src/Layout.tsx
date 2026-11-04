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
        <AuthBar />
      </header>
      <Outlet />
    </div>
  );
}
