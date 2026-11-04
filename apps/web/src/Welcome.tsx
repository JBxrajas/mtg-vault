import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchMe } from "./auth";

/** Pitch for visitors who are not signed in: what an account is for, and how to get one. */
export function Welcome() {
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  if (isLoading || me) return null;
  return (
    <section className="welcome" aria-label="About mtg-vault">
      <h2>Keep track of your Magic collection</h2>
      <p>
        Search is open to everyone. With a free account you can also:
      </p>
      <ul>
        <li>
          <b>Track what you own</b>: every printing, foil and condition, with its market value.
        </li>
        <li>
          <b>Import from Moxfield</b>: upload your CSV and you are done.
        </li>
        <li>
          <b>Build decks</b> and see which cards you already own.
        </li>
      </ul>
      <div className="welcome-actions">
        <Link to="/login" search={{ mode: "register" }} className="button">
          Create a free account
        </Link>
        <Link to="/login" className="link">
          Sign in
        </Link>
      </div>
    </section>
  );
}
