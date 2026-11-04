import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startAppearance } from "./appearance";
import { startLocale } from "./i18n";
import { router } from "./router";
import "./styles.css";

// Apply the saved look before the first render so the page does not flash the default one.
startAppearance();
startLocale();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
