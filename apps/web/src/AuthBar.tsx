import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchMe, logout } from "./auth";

/** Shows who is signed in, or a link to sign in. */
export function AuthBar() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="authbar" />;
  if (!me) {
    return (
      <div className="authbar">
        <Link to="/login">Sign in</Link>
      </div>
    );
  }
  return (
    <div className="authbar">
      Signed in as <strong>{me.displayUsername}</strong> ·{" "}
      <button
        type="button"
        className="link"
        onClick={async () => {
          await logout();
          await queryClient.invalidateQueries({ queryKey: ["me"] });
        }}
      >
        Sign out
      </button>
    </div>
  );
}
