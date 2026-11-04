import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchMe } from "./auth";
import { useI18n } from "./i18n";

/** Pitch for visitors who are not signed in: what an account is for, and how to get one. */
export function Welcome() {
  const { t } = useI18n();
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  if (isLoading || me) return null;
  return (
    <section className="welcome" aria-label={t("welcome.aria")}>
      <h2>{t("welcome.title")}</h2>
      <p>{t("welcome.lead")}</p>
      <ul>
        <li>
          <b>{t("welcome.track.title")}</b>
          {t("welcome.track.text")}
        </li>
        <li>
          <b>{t("welcome.import.title")}</b>
          {t("welcome.import.text")}
        </li>
        <li>
          <b>{t("welcome.decks.title")}</b>
          {t("welcome.decks.text")}
        </li>
      </ul>
      <div className="welcome-actions">
        <Link to="/login" search={{ mode: "register" }} className="button">
          {t("welcome.create")}
        </Link>
        <Link to="/login" className="link">
          {t("auth.signIn")}
        </Link>
      </div>
    </section>
  );
}
