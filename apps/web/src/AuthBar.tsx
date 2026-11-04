import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchMe, logout } from "./auth";
import { useI18n } from "./i18n";
import { refreshSession } from "./session";

/** Shows who is signed in, or a link to sign in. */
export function AuthBar() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="authbar" />;
  if (!me) {
    return (
      <div className="authbar">
        <Link to="/login" className="signin" title={t("auth.signInHint")}>
          {t("auth.signIn")}
        </Link>
      </div>
    );
  }
  return (
    <div className="authbar">
      <span className="who" title={me.displayUsername}>
        {me.displayUsername}
      </span>
      <button
        type="button"
        className="link"
        onClick={async () => {
          await logout();
          await refreshSession(queryClient);
        }}
      >
        {t("auth.signOut")}
      </button>
    </div>
  );
}
