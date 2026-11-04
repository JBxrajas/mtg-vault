import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { CollectionPage } from "./CollectionPage";
import { LoginPage } from "./LoginPage";
import { SearchPage } from "./SearchPage";

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: SearchPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const collectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/collection",
  component: CollectionPage,
});

// Hash history works both on the web and when loaded from file:// in Electron.
export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, loginRoute, collectionRoute]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
