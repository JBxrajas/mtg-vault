import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "./auth";
import { LandingPage } from "./LandingPage";
import { SearchPage } from "./SearchPage";

/** The front door: the landing page for a visitor, the card search for someone who is signed in. */
export function Home() {
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  if (isLoading) return <main className="page" aria-busy="true" />;
  return me ? <SearchPage /> : <LandingPage />;
}
