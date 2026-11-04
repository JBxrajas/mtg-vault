import { Link, Outlet } from "@tanstack/react-router";
import { AuthBar } from "./AuthBar";

const NAV = [
  { to: "/", label: "Search" },
  { to: "/collection", label: "Collection" },
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
              <Link key={item.to} to={item.to} activeOptions={{ exact: true }}>
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
