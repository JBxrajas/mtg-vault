import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

const PATHS = ["/", "/login", "/appearance", "/collection", "/decks", "/decks/$deckId"];

/**
 * Renders a page the way the app does (query client + router) with an in-memory history.
 * The page sits at `path` (matching `route` if given); the other known routes render a marker `route: <path>` so tests can
 * check where a navigation went.
 */
export function renderPage(ui: ReactElement, { path = "/", route }: { path?: string; route?: string } = {}) {
  // `route` is the route pattern when it differs from the URL, for example "/decks/$deckId".
  const pattern = route ?? path;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const routes = PATHS.map((p) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: p,
      component: p === pattern ? () => ui : () => <div>route: {p}</div>,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}

export const aCard = (over: Partial<import("@mtg-vault/shared").CardSearchResult> = {}) => ({
  oracleId: "4457ed35-7c10-48c8-9776-456485fdf070",
  name: "Lightning Bolt",
  manaCost: "{R}",
  typeLine: "Instant",
  similarity: 1,
  image: { small: "https://img.example/small.jpg", normal: "https://img.example/normal.jpg", artCrop: "https://img.example/art.jpg" },
  ...over,
});

export const aPrinting = (over: Partial<import("@mtg-vault/shared").PrintingSummary> = {}) => ({
  id: "p1",
  setCode: "lea",
  setName: "Limited Edition Alpha",
  collectorNumber: "161",
  lang: "en",
  rarity: "common",
  releasedAt: "1993-08-05",
  finishes: ["nonfoil"],
  image: { small: "https://img.example/a-small.jpg", normal: "https://img.example/a-normal.jpg", artCrop: "https://img.example/a-art.jpg" },
  prices: { usd: 630, usdFoil: null, usdEtched: null, eur: 387.57, eurFoil: null, tix: null },
  pricesOn: "2026-11-04",
  ...over,
});

export const aStack = (over: Partial<import("@mtg-vault/shared").CollectionItem> = {}) => ({
  id: "i1",
  printingId: "p1",
  oracleId: "4457ed35-7c10-48c8-9776-456485fdf070",
  name: "Lightning Bolt",
  setCode: "lea",
  setName: "Limited Edition Alpha",
  collectorNumber: "161",
  rarity: "common",
  finish: "nonfoil" as const,
  condition: "NM" as const,
  language: "en",
  quantity: 2,
  purchasePrice: null,
  acquiredOn: null,
  notes: null,
  image: { small: "https://img.example/a-small.jpg", normal: "https://img.example/a-normal.jpg", artCrop: "https://img.example/a-art.jpg" },
  unitPrice: 10,
  pricesOn: "2026-11-04",
  ...over,
});

export const aUser = { id: "u1", username: "alice", displayUsername: "Alice" };

export const aDeck = (over: Partial<import("@mtg-vault/shared").DeckSummary> = {}) => ({
  id: "d1",
  name: "Mono red",
  format: "modern" as const,
  description: null,
  isPublic: false,
  cardCount: 0,
  updatedAt: "2026-11-04T10:00:00.000Z",
  ...over,
});

export const aDeckCard = (over: Partial<import("@mtg-vault/shared").DeckCardEntry> = {}) => ({
  oracleId: "o-bolt",
  name: "Lightning Bolt",
  manaCost: "{R}",
  typeLine: "Instant",
  cmc: 1,
  board: "main" as const,
  quantity: 4,
  printingId: null,
  image: { small: "https://img.example/s.jpg", normal: "https://img.example/n.jpg", artCrop: "https://img.example/a.jpg" },
  owned: 0,
  ...over,
});
