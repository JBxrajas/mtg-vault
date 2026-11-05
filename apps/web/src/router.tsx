import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppearancePage } from "./AppearancePage";
import { ArtPage } from "./ArtPage";
import { CollectionPage } from "./CollectionPage";
import { DeckPage } from "./DeckPage";
import { DecksPage } from "./DecksPage";
import { Layout } from "./Layout";
import { LoginPage } from "./LoginPage";
import { ScanPage } from "./ScanPage";
import { SearchPage } from "./SearchPage";

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: SearchPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { mode?: "register" } =>
    search.mode === "register" ? { mode: "register" } : {},
  component: LoginPage,
});

const appearanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/appearance",
  component: AppearancePage,
});

const collectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/collection",
  component: CollectionPage,
});

const artRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/art/$printingId",
  component: ArtPage,
});

const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scan",
  component: ScanPage,
});

const decksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/decks",
  component: DecksPage,
});

const deckRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/decks/$deckId",
  component: DeckPage,
});

// Hash history works both on the web and when loaded from file:// in Electron.
export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, loginRoute, appearanceRoute, collectionRoute, artRoute, scanRoute, decksRoute, deckRoute]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
